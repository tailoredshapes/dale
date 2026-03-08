import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/tenants.js', () => ({
  getTenantById: vi.fn(),
}));

import { getTenantSecrets, resetTenantSecretsCache } from '../tenant-config.js';
import { getTenantById } from '../../db/tenants.js';

const mockedGetTenant = vi.mocked(getTenantById);

beforeEach(() => {
  vi.clearAllMocks();
  resetTenantSecretsCache();
});

function makeTenant(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tenant-1',
    display_name: 'Test Tenant',
    telegram_bot_token: 'bot-tok-123',
    webhook_secret: 'wh-secret-456',
    stripe_secret_key: 'sk_test_abc',
    stripe_webhook_secret: 'whsec_def',
    ...overrides,
  };
}

describe('getTenantSecrets', () => {
  it('fetches secrets from DB and returns them', async () => {
    mockedGetTenant.mockResolvedValue(makeTenant());

    const secrets = await getTenantSecrets('tenant-1');

    expect(secrets.telegramBotToken).toBe('bot-tok-123');
    expect(secrets.telegramWebhookSecret).toBe('wh-secret-456');
    expect(secrets.stripeSecretKey).toBe('sk_test_abc');
    expect(secrets.stripeWebhookSecret).toBe('whsec_def');
  });

  it('returns cached value on second call within TTL', async () => {
    mockedGetTenant.mockResolvedValue(makeTenant());

    await getTenantSecrets('tenant-1');
    await getTenantSecrets('tenant-1');

    expect(mockedGetTenant).toHaveBeenCalledTimes(1);
  });

  it('re-fetches after TTL expires', async () => {
    mockedGetTenant.mockResolvedValue(makeTenant());

    vi.useFakeTimers();
    try {
      await getTenantSecrets('tenant-1');

      // Advance past the 5-minute TTL
      vi.advanceTimersByTime(5 * 60 * 1000 + 1);

      await getTenantSecrets('tenant-1');

      expect(mockedGetTenant).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('throws when tenant not found', async () => {
    mockedGetTenant.mockResolvedValue(null);

    await expect(getTenantSecrets('tenant-1')).rejects.toThrow(
      'Tenant tenant-1 not found',
    );
  });

  it('throws when required parameters are missing', async () => {
    mockedGetTenant.mockResolvedValue({
      id: 'tenant-1',
      display_name: 'Test Tenant',
      stripe_secret_key: 'sk_test',
    });

    await expect(getTenantSecrets('tenant-1')).rejects.toThrow(
      'Missing required secrets for tenant tenant-1',
    );
  });

  it('sets optional fields to undefined when absent', async () => {
    mockedGetTenant.mockResolvedValue({
      id: 'tenant-1',
      display_name: 'Test Tenant',
      telegram_bot_token: 'bot-tok',
      webhook_secret: 'wh-sec',
    });

    const secrets = await getTenantSecrets('tenant-1');

    expect(secrets.stripeSecretKey).toBeUndefined();
    expect(secrets.stripeWebhookSecret).toBeUndefined();
    expect(secrets.paypalClientId).toBeUndefined();
    expect(secrets.paypalClientSecret).toBeUndefined();
    expect(secrets.paypalWebhookId).toBeUndefined();
  });

  it('caches per tenant independently', async () => {
    mockedGetTenant
      .mockResolvedValueOnce(makeTenant())
      .mockResolvedValueOnce(makeTenant({
        id: 'tenant-2',
        telegram_bot_token: 'bot-2',
        webhook_secret: 'wh-2',
      }));

    await getTenantSecrets('tenant-1');
    await getTenantSecrets('tenant-2');

    expect(mockedGetTenant).toHaveBeenCalledTimes(2);
  });
});
