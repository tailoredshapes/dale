import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/tenants.js', () => ({
  getTenantById: vi.fn(),
  createTenant: vi.fn(),
  updateTenant: vi.fn(),
}));

import { handleGetTenant, handleUpdateTenant, handleOnboard, handleConfigurePayment } from '../routes/tenant.js';
import { getTenantById, createTenant, updateTenant } from '../../db/tenants.js';

const mockedGetTenant = vi.mocked(getTenantById);
const mockedCreateTenant = vi.mocked(createTenant);
const mockedUpdateTenant = vi.mocked(updateTenant);

const AUTH = { tenantId: 'tenant-1' };

function makeDeps(overrides: Record<string, unknown> = {}) {
  return {
    generateSecret: () => 'webhook-secret',
    setWebhook: vi.fn().mockResolvedValue(true),
    registerPayPalWebhook: vi.fn().mockResolvedValue('WH-auto-123'),
    telegramWebhookUrl: 'https://tg.example.com',
    stripeWebhookUrl: 'https://stripe.example.com',
    paypalWebhookUrl: 'https://paypal.example.com',
    paypalBaseUrl: 'https://api-m.sandbox.paypal.com',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('handleGetTenant', () => {
  it('returns tenant data', async () => {
    mockedGetTenant.mockResolvedValue({
      id: 'tenant-1',
      display_name: 'Test Creator',
    });

    const result = await handleGetTenant(AUTH);
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.tenantId).toBe('tenant-1');
    expect(body.displayName).toBe('Test Creator');
  });

  it('returns 404 when not found', async () => {
    mockedGetTenant.mockResolvedValue(null);
    const result = await handleGetTenant(AUTH);
    expect(result.statusCode).toBe(404);
  });
});

describe('handleUpdateTenant', () => {
  it('updates tenant', async () => {
    mockedUpdateTenant.mockResolvedValue({
      id: 'tenant-1',
      display_name: 'New',
    });

    const result = await handleUpdateTenant(AUTH, JSON.stringify({ displayName: 'New' }));
    expect(result.statusCode).toBe(200);
    expect(mockedUpdateTenant).toHaveBeenCalledWith('tenant-1', { display_name: 'New' });
  });

  it('returns 400 for invalid JSON', async () => {
    const result = await handleUpdateTenant(AUTH, 'bad');
    expect(result.statusCode).toBe(400);
  });
});

describe('handleOnboard', () => {
  it('creates tenant with Stripe and returns tenantId from restlette', async () => {
    const deps = makeDeps();
    // createTenant returns the tenant with meshql-rs generated ID
    mockedCreateTenant.mockResolvedValue({
      id: 'meshql-uuid-1234',
      display_name: 'New Creator',
    });

    const result = await handleOnboard('sub-123', JSON.stringify({
      displayName: 'New Creator',
      telegramBotToken: '123:ABC',
      stripeSecretKey: 'sk_test',
      stripeWebhookSecret: 'whsec_test',
    }), deps);

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    // Should use the ID returned from createTenant (meshql-rs generated)
    expect(body.tenantId).toBe('meshql-uuid-1234');
    expect(body.webhookRegistered).toBe(true);
    expect(body.stripeWebhookUrl).toBe('https://stripe.example.com?tenant=meshql-uuid-1234');
    expect(body.paypalWebhookUrl).toBeUndefined();

    // No id field should be passed to createTenant
    expect(mockedCreateTenant).toHaveBeenCalledWith({
      display_name: 'New Creator',
      telegram_bot_token: '123:ABC',
      webhook_secret: 'webhook-secret',
      stripe_secret_key: 'sk_test',
      stripe_webhook_secret: 'whsec_test',
      paypal_client_id: undefined,
      paypal_client_secret: undefined,
    });

    expect(deps.registerPayPalWebhook).not.toHaveBeenCalled();
  });

  it('creates tenant with PayPal only (registers webhook after tenant creation)', async () => {
    const deps = makeDeps();
    mockedCreateTenant.mockResolvedValue({
      id: 'meshql-uuid-5678',
      display_name: 'PayPal Creator',
    });

    const result = await handleOnboard('sub-123', JSON.stringify({
      displayName: 'PayPal Creator',
      telegramBotToken: '123:ABC',
      paypalClientId: 'pp-client',
      paypalClientSecret: 'pp-secret',
    }), deps);

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.tenantId).toBe('meshql-uuid-5678');
    expect(body.paypalWebhookUrl).toBe('https://paypal.example.com?tenant=meshql-uuid-5678');
    expect(body.stripeWebhookUrl).toBeUndefined();

    // PayPal webhook registered after tenant creation with real meshql ID
    expect(deps.registerPayPalWebhook).toHaveBeenCalledWith(
      'https://api-m.sandbox.paypal.com',
      'pp-client',
      'pp-secret',
      'https://paypal.example.com?tenant=meshql-uuid-5678',
      [
        'BILLING.SUBSCRIPTION.ACTIVATED',
        'BILLING.SUBSCRIPTION.CANCELLED',
        'BILLING.SUBSCRIPTION.SUSPENDED',
        'PAYMENT.SALE.COMPLETED',
        'PAYMENT.SALE.DENIED',
      ],
    );

    // Tenant updated with PayPal webhook ID
    expect(mockedUpdateTenant).toHaveBeenCalledWith('meshql-uuid-5678', { paypal_webhook_id: 'WH-auto-123' });
  });

  it('creates tenant with both providers', async () => {
    const deps = makeDeps();
    mockedCreateTenant.mockResolvedValue({
      id: 'meshql-uuid-both',
      display_name: 'Both Creator',
    });

    const result = await handleOnboard('sub-123', JSON.stringify({
      displayName: 'Both Creator',
      telegramBotToken: '123:ABC',
      stripeSecretKey: 'sk_test',
      stripeWebhookSecret: 'whsec_test',
      paypalClientId: 'pp-client',
      paypalClientSecret: 'pp-secret',
    }), deps);

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.stripeWebhookUrl).toBe('https://stripe.example.com?tenant=meshql-uuid-both');
    expect(body.paypalWebhookUrl).toBe('https://paypal.example.com?tenant=meshql-uuid-both');

    expect(deps.registerPayPalWebhook).toHaveBeenCalled();
    expect(mockedUpdateTenant).toHaveBeenCalledWith('meshql-uuid-both', { paypal_webhook_id: 'WH-auto-123' });
  });

  it('returns 502 when PayPal registration fails', async () => {
    const deps = makeDeps({
      registerPayPalWebhook: vi.fn().mockRejectedValue(new Error('PayPal webhook registration failed: 422')),
    });
    mockedCreateTenant.mockResolvedValue({
      id: 'meshql-uuid-fail',
      display_name: 'Fail Creator',
    });

    const result = await handleOnboard('sub-123', JSON.stringify({
      displayName: 'Fail Creator',
      telegramBotToken: '123:ABC',
      paypalClientId: 'pp-client',
      paypalClientSecret: 'pp-secret',
    }), deps);

    expect(result.statusCode).toBe(502);
    expect(JSON.parse(result.body).error).toContain('PayPal webhook registration failed');
  });

  it('returns 400 for missing fields', async () => {
    const result = await handleOnboard('sub-123', JSON.stringify({ displayName: 'Test' }), makeDeps());
    expect(result.statusCode).toBe(400);
  });

  it('creates tenant without payment providers', async () => {
    const deps = makeDeps();
    mockedCreateTenant.mockResolvedValue({
      id: 'meshql-uuid-nopay',
      display_name: 'No Payment Creator',
    });

    const result = await handleOnboard('sub-123', JSON.stringify({
      displayName: 'No Payment Creator',
      telegramBotToken: '123:ABC',
    }), deps);

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.tenantId).toBe('meshql-uuid-nopay');
    expect(body.webhookRegistered).toBe(true);
    expect(body.stripeWebhookUrl).toBeUndefined();
    expect(body.paypalWebhookUrl).toBeUndefined();

    expect(deps.registerPayPalWebhook).not.toHaveBeenCalled();
  });
});

function makePaymentDeps(overrides: Record<string, unknown> = {}) {
  return {
    registerPayPalWebhook: vi.fn().mockResolvedValue('WH-auto-456'),
    stripeWebhookUrl: 'https://stripe.example.com',
    paypalWebhookUrl: 'https://paypal.example.com',
    paypalBaseUrl: 'https://api-m.sandbox.paypal.com',
    ...overrides,
  };
}

describe('handleConfigurePayment', () => {
  it('configures Stripe credentials', async () => {
    const deps = makePaymentDeps();
    mockedUpdateTenant.mockResolvedValue({
      id: 'tenant-1',
      display_name: 'Test',
    });

    const result = await handleConfigurePayment(AUTH, JSON.stringify({
      stripeSecretKey: 'sk_test',
      stripeWebhookSecret: 'whsec_test',
    }), deps);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.configured).toBe(true);
    expect(body.stripeWebhookUrl).toBe('https://stripe.example.com?tenant=tenant-1');
    expect(body.paypalWebhookUrl).toBeUndefined();

    expect(mockedUpdateTenant).toHaveBeenCalledWith('tenant-1', {
      stripe_secret_key: 'sk_test',
      stripe_webhook_secret: 'whsec_test',
    });
    expect(deps.registerPayPalWebhook).not.toHaveBeenCalled();
  });

  it('configures PayPal credentials and auto-registers webhook', async () => {
    const deps = makePaymentDeps();
    mockedUpdateTenant.mockResolvedValue({
      id: 'tenant-1',
      display_name: 'Test',
    });

    const result = await handleConfigurePayment(AUTH, JSON.stringify({
      paypalClientId: 'pp-client',
      paypalClientSecret: 'pp-secret',
    }), deps);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.configured).toBe(true);
    expect(body.paypalWebhookUrl).toBe('https://paypal.example.com?tenant=tenant-1');

    expect(deps.registerPayPalWebhook).toHaveBeenCalledWith(
      'https://api-m.sandbox.paypal.com',
      'pp-client',
      'pp-secret',
      'https://paypal.example.com?tenant=tenant-1',
      expect.any(Array),
    );

    expect(mockedUpdateTenant).toHaveBeenCalledWith('tenant-1', {
      paypal_client_id: 'pp-client',
      paypal_client_secret: 'pp-secret',
      paypal_webhook_id: 'WH-auto-456',
    });
  });

  it('returns 400 when no provider specified', async () => {
    const result = await handleConfigurePayment(AUTH, JSON.stringify({}), makePaymentDeps());
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toContain('At least one payment provider');
  });

  it('returns 400 when Stripe key provided without secret', async () => {
    const result = await handleConfigurePayment(AUTH, JSON.stringify({
      stripeSecretKey: 'sk_test',
    }), makePaymentDeps());
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toContain('stripeSecretKey and stripeWebhookSecret');
  });

  it('returns 400 when PayPal client ID provided without secret', async () => {
    const result = await handleConfigurePayment(AUTH, JSON.stringify({
      paypalClientId: 'pp-client',
    }), makePaymentDeps());
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toContain('paypalClientId and paypalClientSecret');
  });

  it('returns 502 when PayPal registration fails', async () => {
    const deps = makePaymentDeps({
      registerPayPalWebhook: vi.fn().mockRejectedValue(new Error('PayPal error')),
    });
    const result = await handleConfigurePayment(AUTH, JSON.stringify({
      paypalClientId: 'pp-client',
      paypalClientSecret: 'pp-secret',
    }), deps);
    expect(result.statusCode).toBe(502);
  });

  it('returns 400 for invalid JSON', async () => {
    const result = await handleConfigurePayment(AUTH, 'bad', makePaymentDeps());
    expect(result.statusCode).toBe(400);
  });
});
