/**
 * Cleanup utilities for E2E tests.
 *
 * Note: DynamoDB and SSM cleanup have been removed as the system now uses
 * meshql-rs for data storage. The meshql-rs data is ephemeral in the test
 * docker volume and doesn't require explicit cleanup.
 */
import type { E2EConfig } from '../env.js';
import { clearTenantSecretsCache } from './ssm.js';

/**
 * Clean up tenant data.
 * Now just clears the local secrets cache since meshql-rs data is ephemeral.
 */
export async function cleanupDynamoDBTenant(config: E2EConfig, tenantId: string): Promise<void> {
  // meshql-rs data is ephemeral in the test volume - no cleanup needed
  // Just clear the local secrets cache
  clearTenantSecretsCache(tenantId);
}

/**
 * Clean up webhook secret mapping.
 * No-op since meshql-rs handles this internally.
 */
export async function cleanupWebhookSecret(config: E2EConfig, webhookSecret: string): Promise<void> {
  // No-op: meshql-rs data is ephemeral in the test volume
}

/**
 * Clean up SSM parameters for a tenant.
 * No-op since SSM is no longer used - secrets are stored in meshql-rs.
 */
export async function cleanupSSMParams(config: E2EConfig, tenantId: string): Promise<void> {
  // No-op: SSM is no longer used
  // Secrets are now stored in meshql-rs on the Tenant object
}
