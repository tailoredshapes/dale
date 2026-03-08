import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

vi.mock('../../db/tenants.js', () => ({
  getTenantByWebhookSecret: vi.fn(),
}));

import { extractAuthContext, extractCognitoSub } from '../middleware/auth.js';
import { getTenantByWebhookSecret } from '../../db/tenants.js';

const mockedGetTenant = vi.mocked(getTenantByWebhookSecret);

beforeEach(() => {
  vi.clearAllMocks();
});

function makeEvent(secret?: string, sub?: string): APIGatewayProxyEventV2 {
  return {
    headers: secret ? { 'x-webhook-secret': secret } : {},
    requestContext: {
      authorizer: sub ? { jwt: { claims: { sub } } } : undefined,
    },
  } as unknown as APIGatewayProxyEventV2;
}

describe('extractCognitoSub', () => {
  it('extracts sub from JWT claims', () => {
    const result = extractCognitoSub(makeEvent(undefined, 'user-123'));
    expect(result).toBe('user-123');
  });

  it('returns null if no claims', () => {
    const result = extractCognitoSub(makeEvent());
    expect(result).toBeNull();
  });
});

describe('extractAuthContext', () => {
  it('returns auth context for existing tenant', async () => {
    mockedGetTenant.mockResolvedValue({
      id: 't1',
      display_name: 'Test',
      webhook_secret: 'secret-123',
    });

    const result = await extractAuthContext(makeEvent('secret-123'));
    expect(result).toEqual({ tenantId: 't1' });
  });

  it('returns null if no webhook secret header', async () => {
    const result = await extractAuthContext(makeEvent());
    expect(result).toBeNull();
  });

  it('returns null if tenant not found', async () => {
    mockedGetTenant.mockResolvedValue(null);
    const result = await extractAuthContext(makeEvent('unknown-secret'));
    expect(result).toBeNull();
  });
});
