import { graphql, restPost, restPut, restGet } from './client.js';
import type { Tenant } from '../shared/types.js';

interface TenantInput {
  display_name: string;
  telegram_bot_token?: string;
  webhook_secret?: string;
  stripe_secret_key?: string;
  stripe_webhook_secret?: string;
  paypal_client_id?: string;
  paypal_client_secret?: string;
  paypal_webhook_id?: string;
}

export async function createTenant(
  tenant: TenantInput,
): Promise<Tenant> {
  // Let meshql-rs restlette generate the ID
  return restPost<Tenant>('/tenant/api', tenant);
}

export async function getTenantById(
  tenantId: string,
): Promise<Tenant | null> {
  return restGet<Tenant>('/tenant/api', tenantId);
}

export async function getTenantByWebhookSecret(
  webhookSecret: string,
): Promise<Tenant | null> {
  const query = `
    query GetByWebhookSecret($webhook_secret: String) {
      getByWebhookSecret(webhook_secret: $webhook_secret) {
        id
        display_name
        telegram_bot_token
        webhook_secret
        stripe_secret_key
        stripe_webhook_secret
        paypal_client_id
        paypal_client_secret
        paypal_webhook_id
      }
    }
  `;
  const result = await graphql<{ getByWebhookSecret: Tenant | null }>(
    '/tenant/graph',
    query,
    { webhook_secret: webhookSecret },
  );
  return result.getByWebhookSecret;
}

export async function updateTenant(
  tenantId: string,
  updates: Partial<TenantInput>,
): Promise<Tenant> {
  return restPut<Tenant>('/tenant/api', tenantId, updates);
}
