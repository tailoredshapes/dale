/**
 * Tenant secrets cache - replaces SSM parameter lookups.
 * Secrets are now stored in meshql-rs on the Tenant object and cached here
 * when retrieved during onboarding or payment configuration.
 */
import type { E2EConfig } from '../env.js';

// Cache structure: tenantId -> { fieldName -> value }
const tenantSecretsCache: Map<string, Map<string, string>> = new Map();

/**
 * Map SSM parameter path names to tenant field names
 */
function mapParameterNameToField(paramName: string): string {
  const fieldMap: Record<string, string> = {
    'telegram-webhook-secret': 'webhookSecret',
    'stripe-webhook-secret': 'stripeWebhookSecret',
    'stripe-secret-key': 'stripeSecretKey',
    'paypal-client-id': 'paypalClientId',
    'paypal-client-secret': 'paypalClientSecret',
  };
  return fieldMap[paramName] || paramName;
}

/**
 * Parse an SSM-style path to extract tenantId and field name.
 * Path format: /dale/tenants/{tenantId}/{field-name}
 */
function parseParameterPath(path: string): { tenantId: string; fieldName: string } | null {
  const match = path.match(/^\/dale\/tenants\/([^/]+)\/(.+)$/);
  if (!match) {
    return null;
  }
  return {
    tenantId: match[1],
    fieldName: mapParameterNameToField(match[2]),
  };
}

/**
 * Cache a tenant secret for later retrieval.
 * Call this after onboarding or payment configuration.
 */
export function cacheTenantSecret(tenantId: string, fieldName: string, value: string): void {
  let secrets = tenantSecretsCache.get(tenantId);
  if (!secrets) {
    secrets = new Map();
    tenantSecretsCache.set(tenantId, secrets);
  }
  secrets.set(fieldName, value);
}

/**
 * Cache multiple secrets for a tenant at once.
 */
export function cacheTenantSecrets(tenantId: string, secrets: Record<string, string>): void {
  for (const [fieldName, value] of Object.entries(secrets)) {
    if (value !== undefined && value !== null) {
      cacheTenantSecret(tenantId, fieldName, value);
    }
  }
}

/**
 * Get a tenant secret from the cache.
 */
export function getTenantSecretFromCache(tenantId: string, fieldName: string): string | undefined {
  return tenantSecretsCache.get(tenantId)?.get(fieldName);
}

/**
 * Clear the secrets cache for a tenant (used during cleanup).
 */
export function clearTenantSecretsCache(tenantId: string): void {
  tenantSecretsCache.delete(tenantId);
}

/**
 * Clear all cached secrets (used between test scenarios).
 */
export function clearAllSecretsCache(): void {
  tenantSecretsCache.clear();
}

/**
 * Get a parameter value using the SSM-style path format.
 * This replaces the old SSM lookup - it now uses the local cache.
 *
 * @param name - SSM-style path like /dale/tenants/{tenantId}/telegram-webhook-secret
 * @param config - E2E configuration (unused but kept for API compatibility)
 */
export async function getSSMParameter(name: string, config?: E2EConfig): Promise<string> {
  const parsed = parseParameterPath(name);
  if (!parsed) {
    throw new Error(`Invalid parameter path format: ${name}`);
  }

  const { tenantId, fieldName } = parsed;
  const cachedValue = getTenantSecretFromCache(tenantId, fieldName);

  if (!cachedValue) {
    throw new Error(
      `Tenant secret not found in cache: ${name}\n` +
      `Ensure the onboarding or payment configuration step cached the secret.\n` +
      `TenantId: ${tenantId}, Field: ${fieldName}`
    );
  }

  return cachedValue;
}
