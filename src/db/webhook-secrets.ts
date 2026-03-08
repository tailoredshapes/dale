import { getTenantByWebhookSecret } from './tenants.js';

// Webhook secret lookup now goes through Tenant
// This module exists for backward compatibility

export async function getTenantIdByWebhookSecret(
  secret: string,
): Promise<string | null> {
  const tenant = await getTenantByWebhookSecret(secret);
  return tenant?.id ?? null;
}
