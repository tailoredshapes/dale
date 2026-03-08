import { getTenantByWebhookSecret } from '../db/tenants.js';

const webhookSecretCache = new Map<string, string>();

export async function getTenantIdByWebhookSecret(
  secret: string,
): Promise<string | null> {
  const cached = webhookSecretCache.get(secret);
  if (cached) return cached;

  const tenant = await getTenantByWebhookSecret(secret);
  const tenantId = tenant?.id;

  if (tenantId) {
    webhookSecretCache.set(secret, tenantId);
  }
  return tenantId ?? null;
}

export function resetWebhookSecretCache(): void {
  webhookSecretCache.clear();
}
