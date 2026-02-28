import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { SSMClient, GetParametersByPathCommand } from '@aws-sdk/client-ssm';

const ssmMock = mockClient(SSMClient);

import { getTenantSecrets, resetTenantSecretsCache } from '../tenant-config.js';

beforeEach(() => {
  ssmMock.reset();
  resetTenantSecretsCache();
});

const basePath = '/dale/tenants/tenant-1/';

function ssmParams(overrides: Record<string, string> = {}) {
  const defaults: Record<string, string> = {
    'telegram-bot-token': 'bot-tok-123',
    'telegram-webhook-secret': 'wh-secret-456',
    'stripe-secret-key': 'sk_test_abc',
    'stripe-webhook-secret': 'whsec_def',
  };
  const merged = { ...defaults, ...overrides };
  return Object.entries(merged).map(([key, value]) => ({
    Name: `${basePath}${key}`,
    Value: value,
  }));
}

describe('getTenantSecrets', () => {
  it('fetches secrets from SSM and returns them', async () => {
    ssmMock.on(GetParametersByPathCommand).resolves({
      Parameters: ssmParams(),
    });

    const secrets = await getTenantSecrets('tenant-1');

    expect(secrets.telegramBotToken).toBe('bot-tok-123');
    expect(secrets.telegramWebhookSecret).toBe('wh-secret-456');
    expect(secrets.stripeSecretKey).toBe('sk_test_abc');
    expect(secrets.stripeWebhookSecret).toBe('whsec_def');
  });

  it('returns cached value on second call within TTL', async () => {
    ssmMock.on(GetParametersByPathCommand).resolves({
      Parameters: ssmParams(),
    });

    await getTenantSecrets('tenant-1');
    await getTenantSecrets('tenant-1');

    expect(ssmMock.commandCalls(GetParametersByPathCommand)).toHaveLength(1);
  });

  it('re-fetches after TTL expires', async () => {
    ssmMock.on(GetParametersByPathCommand).resolves({
      Parameters: ssmParams(),
    });

    vi.useFakeTimers();
    try {
      await getTenantSecrets('tenant-1');

      // Advance past the 5-minute TTL
      vi.advanceTimersByTime(5 * 60 * 1000 + 1);

      await getTenantSecrets('tenant-1');

      expect(ssmMock.commandCalls(GetParametersByPathCommand)).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('handles paginated SSM results', async () => {
    ssmMock
      .on(GetParametersByPathCommand)
      .resolvesOnce({
        Parameters: [
          { Name: `${basePath}telegram-bot-token`, Value: 'bot-tok' },
          { Name: `${basePath}telegram-webhook-secret`, Value: 'wh-sec' },
        ],
        NextToken: 'page2',
      })
      .resolvesOnce({
        Parameters: [
          { Name: `${basePath}stripe-secret-key`, Value: 'sk_test' },
        ],
      });

    const secrets = await getTenantSecrets('tenant-1');

    expect(secrets.telegramBotToken).toBe('bot-tok');
    expect(secrets.stripeSecretKey).toBe('sk_test');
    expect(ssmMock.commandCalls(GetParametersByPathCommand)).toHaveLength(2);
  });

  it('throws when required parameters are missing', async () => {
    ssmMock.on(GetParametersByPathCommand).resolves({
      Parameters: [
        { Name: `${basePath}stripe-secret-key`, Value: 'sk_test' },
      ],
    });

    await expect(getTenantSecrets('tenant-1')).rejects.toThrow(
      'Missing SSM parameters for tenant tenant-1',
    );
  });

  it('sets optional fields to undefined when absent', async () => {
    ssmMock.on(GetParametersByPathCommand).resolves({
      Parameters: [
        { Name: `${basePath}telegram-bot-token`, Value: 'bot-tok' },
        { Name: `${basePath}telegram-webhook-secret`, Value: 'wh-sec' },
      ],
    });

    const secrets = await getTenantSecrets('tenant-1');

    expect(secrets.stripeSecretKey).toBeUndefined();
    expect(secrets.stripeWebhookSecret).toBeUndefined();
    expect(secrets.paypalClientId).toBeUndefined();
    expect(secrets.paypalClientSecret).toBeUndefined();
    expect(secrets.paypalWebhookId).toBeUndefined();
  });

  it('caches per tenant independently', async () => {
    ssmMock
      .on(GetParametersByPathCommand, { Path: '/dale/tenants/tenant-1/', WithDecryption: true })
      .resolves({ Parameters: ssmParams() })
      .on(GetParametersByPathCommand, { Path: '/dale/tenants/tenant-2/', WithDecryption: true })
      .resolves({
        Parameters: [
          { Name: '/dale/tenants/tenant-2/telegram-bot-token', Value: 'bot-2' },
          { Name: '/dale/tenants/tenant-2/telegram-webhook-secret', Value: 'wh-2' },
        ],
      });

    await getTenantSecrets('tenant-1');
    await getTenantSecrets('tenant-2');

    expect(ssmMock.commandCalls(GetParametersByPathCommand)).toHaveLength(2);
  });
});
