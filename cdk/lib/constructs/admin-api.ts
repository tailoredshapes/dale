import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Runtime, Architecture } from 'aws-cdk-lib/aws-lambda';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { Construct } from 'constructs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface AdminApiProps {
  meshqlUrl: string;
  telegramWebhookUrl: string;
  stripeWebhookUrl: string;
  paypalWebhookUrl: string;
  paypalBaseUrl?: string;
  envName: string;
  telegramTestMode?: boolean;
  googleClientId?: string;
  googleClientSecret?: string;
  appleClientId?: string;
  appleTeamId?: string;
  appleKeyId?: string;
  applePrivateKey?: string;
  callbackUrls?: string[];
  logoutUrls?: string[];
}

export class AdminApi extends Construct {
  public readonly api: apigwv2.HttpApi;
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: AdminApiProps) {
    super(scope, id);

    // Cognito User Pool
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `dale-creators-${props.envName}`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Google identity provider
    if (props.googleClientId && props.googleClientSecret) {
      new cognito.UserPoolIdentityProviderGoogle(this, 'Google', {
        userPool: this.userPool,
        clientId: props.googleClientId,
        clientSecretValue: cdk.SecretValue.unsafePlainText(props.googleClientSecret),
        scopes: ['openid', 'email', 'profile'],
        attributeMapping: {
          email: cognito.ProviderAttribute.GOOGLE_EMAIL,
          givenName: cognito.ProviderAttribute.GOOGLE_GIVEN_NAME,
          familyName: cognito.ProviderAttribute.GOOGLE_FAMILY_NAME,
        },
      });
    }

    // Apple identity provider
    if (props.appleClientId && props.appleTeamId && props.appleKeyId && props.applePrivateKey) {
      new cognito.UserPoolIdentityProviderApple(this, 'Apple', {
        userPool: this.userPool,
        clientId: props.appleClientId,
        teamId: props.appleTeamId,
        keyId: props.appleKeyId,
        privateKey: props.applePrivateKey,
        scopes: ['openid', 'email', 'name'],
        attributeMapping: {
          email: cognito.ProviderAttribute.APPLE_EMAIL,
          givenName: cognito.ProviderAttribute.APPLE_FIRST_NAME,
          familyName: cognito.ProviderAttribute.APPLE_LAST_NAME,
        },
      });
    }

    // Cognito domain for hosted UI
    this.userPool.addDomain('Domain', {
      cognitoDomain: {
        domainPrefix: `dale-${props.envName}-${cdk.Aws.ACCOUNT_ID}`,
      },
    });

    // User pool client
    this.userPoolClient = this.userPool.addClient('WebClient', {
      authFlows: {
        userSrp: true,
        userPassword: true,
        adminUserPassword: props.envName !== 'prod',
      },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        callbackUrls: props.callbackUrls ?? ['http://localhost:5173/callback'],
        logoutUrls: props.logoutUrls ?? ['http://localhost:5173/'],
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
        ...(props.googleClientId ? [cognito.UserPoolClientIdentityProvider.GOOGLE] : []),
        ...(props.appleClientId ? [cognito.UserPoolClientIdentityProvider.APPLE] : []),
      ],
    });

    // Admin Lambda
    const adminHandler = new lambda.NodejsFunction(this, 'AdminHandler', {
      runtime: Runtime.NODEJS_20_X,
      architecture: Architecture.ARM_64,
      entry: path.join(__dirname, '../../../src/admin/api.ts'),
      handler: 'handler',
      environment: {
        MESHQL_URL: props.meshqlUrl,
        TELEGRAM_WEBHOOK_URL: props.telegramWebhookUrl,
        STRIPE_WEBHOOK_URL: props.stripeWebhookUrl,
        PAYPAL_WEBHOOK_URL: props.paypalWebhookUrl,
        PAYPAL_BASE_URL: props.paypalBaseUrl ?? 'https://api-m.paypal.com',
        COGNITO_USER_POOL_ID: this.userPool.userPoolId,
        ...(props.telegramTestMode ? { TELEGRAM_TEST_MODE: 'true' } : {}),
      },
      bundling: {
        externalModules: ['@aws-sdk/*'],
        format: lambda.OutputFormat.ESM,
        target: 'node20',
        nodeModules: ['ulid'],
      },
      timeout: cdk.Duration.seconds(15),
    });

    const cognitoPolicy = new iam.PolicyStatement({
      actions: ['cognito-idp:AdminCreateUser', 'cognito-idp:ListUsers'],
      resources: [this.userPool.userPoolArn],
    });
    adminHandler.addToRolePolicy(cognitoPolicy);

    // JWT authorizer
    const issuer = `https://cognito-idp.${cdk.Aws.REGION}.amazonaws.com/${this.userPool.userPoolId}`;
    const authorizer = new HttpJwtAuthorizer('JwtAuth', issuer, {
      jwtAudience: [this.userPoolClient.userPoolClientId],
    });

    // HTTP API
    this.api = new apigwv2.HttpApi(this, 'HttpApi', {
      apiName: `dale-admin-api-${props.envName}`,
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [apigwv2.CorsHttpMethod.ANY],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    const integration = new HttpLambdaIntegration('AdminIntegration', adminHandler);

    this.api.addRoutes({
      path: '/{proxy+}',
      methods: [
        apigwv2.HttpMethod.GET,
        apigwv2.HttpMethod.POST,
        apigwv2.HttpMethod.PUT,
        apigwv2.HttpMethod.DELETE,
      ],
      integration,
      authorizer,
    });
  }
}
