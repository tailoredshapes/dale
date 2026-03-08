import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

vi.mock('../../shared/tenant-config.js', () => ({
  getTenantSecrets: vi.fn(),
}));

vi.mock('../verify.js', () => ({
  verifyPayPalWebhook: vi.fn(),
}));

vi.mock('../events.js', () => ({
  handleSubscriptionActivated: vi.fn(),
  handleSubscriptionCancelled: vi.fn(),
  handleSubscriptionSuspended: vi.fn(),
  handlePaymentCompleted: vi.fn(),
  handlePaymentDenied: vi.fn(),
}));

import { handler } from '../webhook.js';
import { getTenantSecrets } from '../../shared/tenant-config.js';
import { verifyPayPalWebhook } from '../verify.js';
import { handleSubscriptionActivated } from '../events.js';

const mockedGetSecrets = vi.mocked(getTenantSecrets);
const mockedVerify = vi.mocked(verifyPayPalWebhook);
const mockedHandleActivated = vi.mocked(handleSubscriptionActivated);

const TENANT_SECRETS = {
  telegramBotToken: '123:ABC',
  telegramWebhookSecret: 'test-webhook-secret',
  paypalClientId: 'pp-client-id',
  paypalClientSecret: 'pp-client-secret',
  paypalWebhookId: 'WH-123',
};

function makeEvent(body: string, tenantId = 'tenant-1'): APIGatewayProxyEventV2 {
  return {
    headers: {
      'paypal-auth-algo': 'SHA256withRSA',
      'paypal-cert-url': 'https://api.paypal.com/cert',
      'paypal-transmission-id': 'tx-123',
      'paypal-transmission-sig': 'sig-abc',
      'paypal-transmission-time': '2024-01-01T00:00:00Z',
    },
    queryStringParameters: { tenant: tenantId },
    body,
  } as unknown as APIGatewayProxyEventV2;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetSecrets.mockResolvedValue(TENANT_SECRETS);
  mockedVerify.mockResolvedValue(true);
});

describe('PayPal webhook handler', () => {
  it('returns 400 for missing tenant parameter', async () => {
    const event = {
      headers: {},
      queryStringParameters: {},
      body: '{}',
    } as unknown as APIGatewayProxyEventV2;
    const result = await handler(event);
    expect(result.statusCode).toBe(400);
    expect(result.body).toContain('tenant');
  });

  it('returns 400 when PayPal not configured for tenant', async () => {
    mockedGetSecrets.mockResolvedValue({
      telegramBotToken: '123:ABC',
      telegramWebhookSecret: 'test',
    });
    const result = await handler(makeEvent('{}'));
    expect(result.statusCode).toBe(400);
    expect(result.body).toContain('PayPal not configured');
  });

  it('returns 400 for invalid signature', async () => {
    mockedVerify.mockResolvedValue(false);
    const result = await handler(makeEvent('{}'));
    expect(result.statusCode).toBe(400);
    expect(result.body).toContain('Invalid signature');
  });

  it('routes BILLING.SUBSCRIPTION.ACTIVATED', async () => {
    const body = JSON.stringify({
      event_type: 'BILLING.SUBSCRIPTION.ACTIVATED',
      resource: { id: 'I-SUB', custom_id: 'tenant-1:123:r1', subscriber: { payer_id: 'PP-123' } },
    });

    const result = await handler(makeEvent(body));
    expect(result.statusCode).toBe(200);
    expect(mockedHandleActivated).toHaveBeenCalledWith(
      'tenant-1',
      '123:ABC',
      expect.objectContaining({ event_type: 'BILLING.SUBSCRIPTION.ACTIVATED' }),
    );
  });

  it('returns 200 for unhandled event types', async () => {
    const body = JSON.stringify({ event_type: 'SOME.OTHER.EVENT', resource: {} });
    const result = await handler(makeEvent(body));
    expect(result.statusCode).toBe(200);
  });

  it('returns 500 when event handler throws', async () => {
    const body = JSON.stringify({
      event_type: 'BILLING.SUBSCRIPTION.ACTIVATED',
      resource: {},
    });
    mockedHandleActivated.mockRejectedValue(new Error('DB error'));

    const result = await handler(makeEvent(body));
    expect(result.statusCode).toBe(500);
  });

  it('returns 400 for missing body', async () => {
    const event = {
      headers: {},
      queryStringParameters: { tenant: 'tenant-1' },
      body: null,
    } as unknown as APIGatewayProxyEventV2;
    const result = await handler(event);
    expect(result.statusCode).toBe(400);
  });
});
