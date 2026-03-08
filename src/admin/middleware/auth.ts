import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { getTenantByWebhookSecret } from '../../db/tenants.js';

export interface AuthContext {
  tenantId: string;
}

// In-memory mapping: cognitoSub → tenantId
// Populated during onboarding so JWT-authed requests can resolve tenant
const subToTenantId = new Map<string, string>();

export function registerTenantForSub(cognitoSub: string, tenantId: string): void {
  subToTenantId.set(cognitoSub, tenantId);
}

export async function extractAuthContext(
  event: APIGatewayProxyEventV2,
): Promise<AuthContext | null> {
  // Option 1: X-Webhook-Secret header (Telegram/Stripe/PayPal callbacks)
  const secret = event.headers['x-webhook-secret'];
  if (secret) {
    const tenant = await getTenantByWebhookSecret(secret);
    if (tenant) return { tenantId: tenant.id };
  }

  // Option 2: Cognito JWT Bearer token (admin UI / E2E tests)
  const claims = (event.requestContext as any)?.authorizer?.jwt?.claims;
  const sub = claims?.sub as string | undefined;
  if (sub) {
    const tenantId = subToTenantId.get(sub);
    if (tenantId) return { tenantId };
  }

  return null;
}

export function extractCognitoSub(event: APIGatewayProxyEventV2): string | null {
  const claims = (event.requestContext as any)?.authorizer?.jwt?.claims;
  return (claims?.sub as string) ?? null;
}
