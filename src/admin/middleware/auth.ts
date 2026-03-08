import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { getTenantByWebhookSecret } from '../../db/tenants.js';

export interface AuthContext {
  tenantId: string;
}

export async function extractAuthContext(
  event: APIGatewayProxyEventV2,
): Promise<AuthContext | null> {
  // For simplicity, use X-Webhook-Secret header for auth
  // In production, this would be Cognito JWT
  const secret = event.headers['x-webhook-secret'];
  if (!secret) {
    return null;
  }

  const tenant = await getTenantByWebhookSecret(secret);
  if (!tenant) {
    return null;
  }

  return { tenantId: tenant.id };
}

export function extractCognitoSub(event: APIGatewayProxyEventV2): string | null {
  const claims = (event.requestContext as any)?.authorizer?.jwt?.claims;
  return (claims?.sub as string) ?? null;
}
