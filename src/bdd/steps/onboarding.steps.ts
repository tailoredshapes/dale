import { Given, When, Then, Before } from 'quickpickle';
import { vi, expect } from 'vitest';
import type { DaleWorld } from '../world.js';

// ── Module mocks (hoisted) ───────────────────────────────────────────────────

vi.mock('../../db/tenants.js', () => ({
  getTenantById: vi.fn(),
  getTenantByCognitoSub: vi.fn(),
  createTenant: vi.fn(),
  updateTenant: vi.fn(),
}));

vi.mock('../../telegram/api.js', () => ({
  setWebhook: vi.fn(),
}));

vi.mock('../../paypal/client.js', () => ({
  registerWebhook: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import { handleOnboard, handleConfigureTelegram, handleConfigurePayment } from '../../admin/routes/tenant.js';
import { getTenantById, getTenantByCognitoSub, createTenant, updateTenant } from '../../db/tenants.js';
import { setWebhook } from '../../telegram/api.js';

// ── State ────────────────────────────────────────────────────────────────────

let cognitoSub: string;
let requestBody: Record<string, string>;
let response: { statusCode: number; body: string };
let createdTenantId: string;
let setWebhookCalled: boolean;

const mockDeps = {
  generateSecret: () => 'test-webhook-secret',
  setWebhook: vi.fn(),
  registerPayPalWebhook: vi.fn(),
  telegramWebhookUrl: 'https://webhooks.example.com/telegram',
  stripeWebhookUrl: 'https://webhooks.example.com/stripe',
  paypalWebhookUrl: 'https://webhooks.example.com/paypal',
  paypalBaseUrl: 'https://api.sandbox.paypal.com',
};

Before(async () => {
  vi.clearAllMocks();
  cognitoSub = 'cognito-sub-123';
  requestBody = {};
  createdTenantId = 'tenant-generated-id';
  setWebhookCalled = false;

  vi.mocked(createTenant).mockResolvedValue({
    id: createdTenantId,
    cognito_sub: cognitoSub,
    display_name: 'Test Brand',
    webhook_secret: 'test-webhook-secret',
  } as any);

  vi.mocked(updateTenant).mockResolvedValue(undefined);
  mockDeps.setWebhook.mockResolvedValue(true);
  mockDeps.registerPayPalWebhook.mockResolvedValue('paypal-webhook-id-123');
});

// ── Givens ───────────────────────────────────────────────────────────────────

Given('the Dale system is running', async () => {
  // no-op: mocks are the system
});

Given('no tenant exists for the authenticated user', async () => {
  vi.mocked(getTenantByCognitoSub).mockResolvedValue(null);
});

Given('I am a new authenticated user', async () => {
  cognitoSub = 'new-user-sub-' + Date.now();
});

Given('I have an existing tenant with no Telegram bot configured', async () => {
  vi.mocked(getTenantById).mockResolvedValue({
    id: createdTenantId,
    display_name: 'Test Brand',
    telegram_bot_token: null,
  } as any);
});

Given('I have an existing tenant with a Telegram bot configured', async () => {
  vi.mocked(getTenantById).mockResolvedValue({
    id: createdTenantId,
    display_name: 'Test Brand',
    telegram_bot_token: 'old-token-123:ABC',
  } as any);
});

Given('I have an existing tenant', async () => {
  vi.mocked(getTenantById).mockResolvedValue({
    id: createdTenantId,
    display_name: 'Test Brand',
  } as any);
});

Given('I have an existing tenant with no Stripe configured', async () => {
  vi.mocked(getTenantById).mockResolvedValue({
    id: createdTenantId,
    display_name: 'Test Brand',
    stripe_secret_key: null,
  } as any);
});

Given('I have an existing tenant with no PayPal configured', async () => {
  vi.mocked(getTenantById).mockResolvedValue({
    id: createdTenantId,
    display_name: 'Test Brand',
    paypal_client_id: null,
  } as any);
});

Given('the Telegram API is unavailable', async () => {
  mockDeps.setWebhook.mockResolvedValue(false);
});

Given('the PayPal API returns an error for webhook registration', async () => {
  mockDeps.registerPayPalWebhook.mockRejectedValue(new Error('PayPal API error'));
});

// ── Whens ────────────────────────────────────────────────────────────────────

When('I POST to {string} with:', async (_world: DaleWorld, path: string, table: any) => {
  const rows: string[][] = table.raw ? table.raw() : table;
  requestBody = Object.fromEntries(rows.map((r: string[]) => [r[0], r[1]]));

  if (path === '/api/tenant/onboard') {
    response = await handleOnboard(cognitoSub, JSON.stringify(requestBody), mockDeps);
  }
});

When('I POST to {string} with an empty body', async (_world: DaleWorld, path: string) => {
  if (path === '/api/tenant/onboard') {
    response = await handleOnboard(cognitoSub, JSON.stringify({}), mockDeps);
  }
});

When('I PUT to {string} with:', async (_world: DaleWorld, path: string, table: any) => {
  const rows: string[][] = table.raw ? table.raw() : table;
  requestBody = Object.fromEntries(rows.map((r: string[]) => [r[0], r[1]]));
  const auth = { tenantId: createdTenantId, cognitoSub };

  if (path === '/api/tenant/telegram') {
    response = await handleConfigureTelegram(auth, JSON.stringify(requestBody), {
      setWebhook: mockDeps.setWebhook,
      telegramWebhookUrl: mockDeps.telegramWebhookUrl,
    });
  } else if (path === '/api/tenant/payment') {
    response = await handleConfigurePayment(auth, JSON.stringify(requestBody), {
      registerPayPalWebhook: mockDeps.registerPayPalWebhook,
      stripeWebhookUrl: mockDeps.stripeWebhookUrl,
      paypalWebhookUrl: mockDeps.paypalWebhookUrl,
      paypalBaseUrl: mockDeps.paypalBaseUrl,
    });
  }
});

When('I PUT to {string} with an empty body', async (_world: DaleWorld, path: string) => {
  const auth = { tenantId: createdTenantId, cognitoSub };

  if (path === '/api/tenant/telegram') {
    response = await handleConfigureTelegram(auth, JSON.stringify({}), {
      setWebhook: mockDeps.setWebhook,
      telegramWebhookUrl: mockDeps.telegramWebhookUrl,
    });
  } else if (path === '/api/tenant/payment') {
    response = await handleConfigurePayment(auth, JSON.stringify({}), {
      registerPayPalWebhook: mockDeps.registerPayPalWebhook,
      stripeWebhookUrl: mockDeps.stripeWebhookUrl,
      paypalWebhookUrl: mockDeps.paypalWebhookUrl,
      paypalBaseUrl: mockDeps.paypalBaseUrl,
    });
  }
});

When('I PUT to {string} with only:', async (_world: DaleWorld, path: string, table: any) => {
  const rows: string[][] = table.raw ? table.raw() : table;
  requestBody = Object.fromEntries(rows.map((r: string[]) => [r[0], r[1]]));
  const auth = { tenantId: createdTenantId, cognitoSub };

  if (path === '/api/tenant/payment') {
    response = await handleConfigurePayment(auth, JSON.stringify(requestBody), {
      registerPayPalWebhook: mockDeps.registerPayPalWebhook,
      stripeWebhookUrl: mockDeps.stripeWebhookUrl,
      paypalWebhookUrl: mockDeps.paypalWebhookUrl,
      paypalBaseUrl: mockDeps.paypalBaseUrl,
    });
  }
});

// ── Thens ────────────────────────────────────────────────────────────────────

Then('the response status is {int}', async (_world: DaleWorld, status: number) => {
  expect(response.statusCode).toBe(status);
});

Then('the response contains a {string}', async (_world: DaleWorld, key: string) => {
  const body = JSON.parse(response.body);
  expect(body).toHaveProperty(key);
  expect(body[key]).toBeTruthy();
});

Then('the response contains error {string}', async (_world: DaleWorld, msg: string) => {
  const body = JSON.parse(response.body);
  expect(body.error).toContain(msg);
});

Then('the response contains {string}: {word}', async (_world: DaleWorld, key: string, value: string) => {
  const body = JSON.parse(response.body);
  const expected = value === 'true' ? true : value === 'false' ? false : value;
  expect(body[key]).toBe(expected);
});

Then('no Telegram webhook is registered', async () => {
  expect(mockDeps.setWebhook).not.toHaveBeenCalled();
});

Then('no Stripe configuration is stored', async () => {
  const calls = vi.mocked(createTenant).mock.calls;
  if (calls.length > 0) {
    expect(calls[0][0].stripe_secret_key).toBeUndefined();
  }
});

Then('no PayPal configuration is stored', async () => {
  const calls = vi.mocked(createTenant).mock.calls;
  if (calls.length > 0) {
    expect(calls[0][0].paypal_client_id).toBeUndefined();
  }
});

Then('the Telegram webhook is registered for the new tenant', async () => {
  expect(mockDeps.setWebhook).toHaveBeenCalledWith(
    requestBody.telegramBotToken,
    expect.stringContaining('telegram'),
    expect.any(String),
  );
});

Then('the Telegram webhook is registered for the tenant', async () => {
  expect(mockDeps.setWebhook).toHaveBeenCalledWith(
    requestBody.telegramBotToken,
    expect.stringContaining('telegram'),
    expect.any(String),
  );
});

Then('the new Telegram webhook is registered', async () => {
  expect(mockDeps.setWebhook).toHaveBeenCalledWith(
    requestBody.telegramBotToken,
    expect.any(String),
    expect.any(String),
  );
});

Then('the old webhook is replaced', async () => {
  expect(vi.mocked(updateTenant)).toHaveBeenCalledWith(
    createdTenantId,
    expect.objectContaining({ telegram_bot_token: requestBody.telegramBotToken }),
  );
});

Then("the tenant's Telegram token is not updated", async () => {
  expect(vi.mocked(updateTenant)).not.toHaveBeenCalled();
});

Then('the Stripe keys are stored for the tenant', async () => {
  expect(vi.mocked(updateTenant)).toHaveBeenCalledWith(
    createdTenantId,
    expect.objectContaining({ stripe_secret_key: requestBody.stripeSecretKey }),
  );
});

Then('the PayPal webhook is registered for the tenant', async () => {
  expect(mockDeps.registerPayPalWebhook).toHaveBeenCalled();
});

Then('no PayPal credentials are stored for the tenant', async () => {
  expect(vi.mocked(updateTenant)).not.toHaveBeenCalled();
});
