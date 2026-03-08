use axum::Router;
use merkql::broker::{Broker, BrokerConfig};
use merksql::MerkSql;
use meshql_core::{GraphletteConfig, RestletteConfig, RootConfig, ServerConfig};
use meshql_merksql::{MerksqlRepository, MerksqlSearcher};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

// --- GraphQL schemas (3) ---
const TENANT_GRAPHQL: &str = include_str!("../config/graph/tenant.graphql");
const ROOM_GRAPHQL: &str = include_str!("../config/graph/room.graphql");
const USER_ROOM_GRAPHQL: &str = include_str!("../config/graph/user_room.graphql");

// --- JSON schemas (3) ---
const TENANT_JSON: &str = include_str!("../config/json/tenant.schema.json");
const ROOM_JSON: &str = include_str!("../config/json/room.schema.json");
const USER_ROOM_JSON: &str = include_str!("../config/json/user_room.schema.json");

#[tokio::main]
async fn main() -> Result<(), lambda_http::Error> {
    let efs_path = std::env::var("EFS_MOUNT_PATH").unwrap_or_else(|_| "/mnt/efs".to_string());

    let broker = Broker::open(BrokerConfig::new(PathBuf::from(&efs_path)))
        .map_err(|e| lambda_http::Error::from(format!("broker open failed: {e}")))?;

    let merksql = Arc::new(Mutex::new(MerkSql::new(broker.clone())));

    // ===== REPOSITORIES (3) =====
    let tenant_repo = Arc::new(MerksqlRepository::new(
        broker.clone(),
        "tenant",
        merksql.clone(),
    ));
    let room_repo = Arc::new(MerksqlRepository::new(
        broker.clone(),
        "room",
        merksql.clone(),
    ));
    let user_room_repo = Arc::new(MerksqlRepository::new(
        broker.clone(),
        "user_room",
        merksql.clone(),
    ));

    // ===== SEARCHERS (3) =====
    let tenant_searcher: Arc<dyn meshql_core::Searcher> =
        Arc::new(MerksqlSearcher::new(broker.clone(), "tenant", merksql.clone()));
    let room_searcher: Arc<dyn meshql_core::Searcher> =
        Arc::new(MerksqlSearcher::new(broker.clone(), "room", merksql.clone()));
    let user_room_searcher: Arc<dyn meshql_core::Searcher> =
        Arc::new(MerksqlSearcher::new(broker.clone(), "user_room", merksql.clone()));

    // ===== ROOT CONFIGS (3) =====

    let tenant_config = RootConfig::builder()
        .singleton("getById", r#"{"id": "{{id}}"}"#)
        .vector("getAll", "{}")
        .singleton("getByWebhookSecret", r#"{"payload.webhook_secret": "{{webhook_secret}}"}"#)
        .build();

    let room_config = RootConfig::builder()
        .singleton("getById", r#"{"id": "{{id}}"}"#)
        .vector("getAll", "{}")
        .vector("getByTenantId", r#"{"payload.tenant_id": "{{tenant_id}}"}"#)
        .singleton("getByTelegramGroupId", r#"{"payload.telegram_group_id": "{{telegram_group_id}}"}"#)
        .build();

    let user_room_config = RootConfig::builder()
        .singleton("getById", r#"{"id": "{{id}}"}"#)
        .vector("getAll", "{}")
        .vector("getByTenantAndUser", r#"{"payload.tenant_id": "{{tenant_id}}", "payload.telegram_user_id": {{telegram_user_id}}}"#)
        .singleton("getByTenantUserRoom", r#"{"payload.tenant_id": "{{tenant_id}}", "payload.telegram_user_id": {{telegram_user_id}}, "payload.room_id": "{{room_id}}"}"#)
        .vector("getByTenantAndRoom", r#"{"payload.tenant_id": "{{tenant_id}}", "payload.room_id": "{{room_id}}"}"#)
        .singleton("getByStripeCustomerId", r#"{"payload.stripe_customer_id": "{{stripe_customer_id}}"}"#)
        .singleton("getByPaypalPayerId", r#"{"payload.paypal_payer_id": "{{paypal_payer_id}}"}"#)
        .build();

    // ===== SERVER CONFIG =====

    let config = ServerConfig {
        port: 0,
        graphlettes: vec![
            GraphletteConfig {
                path: "/tenant/graph".to_string(),
                schema_text: TENANT_GRAPHQL.to_string(),
                root_config: tenant_config,
                searcher: tenant_searcher,
            },
            GraphletteConfig {
                path: "/room/graph".to_string(),
                schema_text: ROOM_GRAPHQL.to_string(),
                root_config: room_config,
                searcher: room_searcher,
            },
            GraphletteConfig {
                path: "/user_room/graph".to_string(),
                schema_text: USER_ROOM_GRAPHQL.to_string(),
                root_config: user_room_config,
                searcher: user_room_searcher,
            },
        ],
        restlettes: vec![
            RestletteConfig {
                path: "/tenant/api".to_string(),
                schema_json: serde_json::from_str(TENANT_JSON)
                    .expect("invalid tenant JSON schema"),
                repository: tenant_repo,
            },
            RestletteConfig {
                path: "/room/api".to_string(),
                schema_json: serde_json::from_str(ROOM_JSON)
                    .expect("invalid room JSON schema"),
                repository: room_repo,
            },
            RestletteConfig {
                path: "/user_room/api".to_string(),
                schema_json: serde_json::from_str(USER_ROOM_JSON)
                    .expect("invalid user_room JSON schema"),
                repository: user_room_repo,
            },
        ],
    };

    // Build app
    let app: Router = meshql_server::build_app(config)
        .await
        .map_err(|e| lambda_http::Error::from(format!("build_app failed: {e}")))?;

    if std::env::var("RUN_MODE").as_deref() == Ok("server") {
        tracing_subscriber::fmt()
            .with_env_filter(
                tracing_subscriber::EnvFilter::try_from_default_env()
                    .unwrap_or_else(|_| "info".into()),
            )
            .init();

        let port = std::env::var("PORT").unwrap_or_else(|_| "8080".to_string());
        let addr = format!("0.0.0.0:{port}");
        tracing::info!("Dale backend listening on {addr}");
        let listener = tokio::net::TcpListener::bind(&addr)
            .await
            .map_err(|e| lambda_http::Error::from(format!("bind failed: {e}")))?;
        axum::serve(listener, app)
            .await
            .map_err(|e| lambda_http::Error::from(format!("serve failed: {e}")))?;
        Ok(())
    } else {
        lambda_http::run(app).await
    }
}
