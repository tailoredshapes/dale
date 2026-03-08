import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

vi.mock('../../shared/tenant-config.js', () => ({
  getTenantSecrets: vi.fn(),
}));

const { mockConstructEvent } = vi.hoisted(() => {
  const mockConstructEvent = vi.fn();
  return { mockConstructEvent };
});

vi.mock('stripe', async (importOriginal) => {
  const mod = await importOriginal<typeof import('stripe')>();
  class MockStripe {
    webhooks = { constructEvent: mockConstructEvent };
    constructor(_key: string) {}
  }
  return { ...mod, default: MockStripe, Stripe: MockStripe };
});

vi.mock('../events.js', () => ({
  handleCheckoutCompleted: vi.fn(),
  handleInvoicePaid: vi.fn(),
  handleInvoicePaymentFailed: vi.fn(),
  handleSubscriptionDeleted: vi.fn(),
  handleSubscriptionUpdated: vi.fn(),
}));

import { handler } from '../webhook.js';
import { getTenantSecrets } from '../../shared/tenant-config.js';
import { handleCheckoutCompleted } from '../events.js';

const mockedGetSecrets = vi.mocked(getTenantSecrets);
const mockedHandleCheckout = vi.mocked(handleCheckoutCompleted);

const TENANT_SECRETS = {
  telegramBotToken: '123:ABC',
  telegramWebhookSecret: 'test-webhook-secret',
  stripeSecretKey: 'sk_test_xxx',
  stripeWebhookSecret: 'whsec_xxx',
};

function makeEvent(body: string, tenantId = 'tenant-1', signature = 'sig_test'): APIGatewayProxyEventV2 {
  return {
    headers: { 'stripe-signature': signature },
    queryStringParameters: { tenant: tenantId },
    body,
  } as unknown as APIGatewayProxyEventV2;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetSecrets.mockResolvedValue(TENANT_SECRETS);
});

describe('Stripe webhook handler', () => {
  it('returns 400 for missing tenant parameter', async () => {
    const event = {
      headers: { 'stripe-signature': 'sig' },
      queryStringParameters: {},
      body: '{}',
    } as unknown as APIGatewayProxyEventV2;
    const result = await handler(event);
    expect(result.statusCode).toBe(400);
    expect(result.body).toContain('tenant');
  });

  it('returns 400 when Stripe not configured', async () => {
    mockedGetSecrets.mockResolvedValue({
      telegramBotToken: '123:ABC',
      telegramWebhookSecret: 'test-webhook-secret',
    });
    const result = await handler(makeEvent('{}'));
    expect(result.statusCode).toBe(400);
    expect(result.body).toContain('Stripe not configured');
  });

  it('returns 400 for missing signature', async () => {
    const event = {
      headers: {},
      queryStringParameters: { tenant: 'tenant-1' },
      body: '{}',
    } as unknown as APIGatewayProxyEventV2;
    const result = await handler(event);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 for invalid signature', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('Invalid signature');
    });
    const result = await handler(makeEvent('{}'));
    expect(result.statusCode).toBe(400);
  });

  it('routes checkout.session.completed with tenant context', async () => {
    const session = { id: 'cs_test', client_reference_id: 'tenant-1:123:room-1' };
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: session },
    });

    const result = await handler(makeEvent('{}'));
    expect(result.statusCode).toBe(200);
    expect(mockedHandleCheckout).toHaveBeenCalledWith(
      'tenant-1',
      '123:ABC',
      session,
    );
  });

  it('returns 200 for unhandled event types', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'some.other.event',
      data: { object: {} },
    });
    const result = await handler(makeEvent('{}'));
    expect(result.statusCode).toBe(200);
  });

  it('returns 500 when event handler throws', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: {} },
    });
    mockedHandleCheckout.mockRejectedValue(new Error('DB error'));

    const result = await handler(makeEvent('{}'));
    expect(result.statusCode).toBe(500);
  });
});
