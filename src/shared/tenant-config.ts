import type { TenantSecrets } from './types.js';
import { getTenantById } from '../db/tenants.js';

interface CacheEntry {
  secrets: TenantSecrets;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function getTenantSecrets(tenantId: string): Promise<TenantSecrets> {
  const cached = cache.get(tenantId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.secrets;
  }

  const tenant = await getTenantById(tenantId);
  if (!tenant) {
    throw new Error(`Tenant ${tenantId} not found`);
  }

  if (!tenant.telegram_bot_token || !tenant.webhook_secret) {
    throw new Error(`Missing required secrets for tenant ${tenantId}`);
  }

  const secrets: TenantSecrets = {
    telegramBotToken: tenant.telegram_bot_token,
    telegramWebhookSecret: tenant.webhook_secret,
    stripeSecretKey: tenant.stripe_secret_key || undefined,
    stripeWebhookSecret: tenant.stripe_webhook_secret || undefined,
    paypalClientId: tenant.paypal_client_id || undefined,
    paypalClientSecret: tenant.paypal_client_secret || undefined,
    paypalWebhookId: tenant.paypal_webhook_id || undefined,
  };

  cache.set(tenantId, { secrets, expiresAt: Date.now() + TTL_MS });
  return secrets;
}

export function resetTenantSecretsCache(): void {
  cache.clear();
}
