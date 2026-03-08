import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verifyPayPalWebhook } from '../verify.js';
import type { TenantSecrets } from '../../shared/types.js';

const originalFetch = global.fetch;
const BASE_URL = 'https://api-m.paypal.com';

const TENANT_SECRETS: TenantSecrets = {
  telegramBotToken: '123:ABC',
  telegramWebhookSecret: 'test-webhook-secret',
  paypalClientId: 'pp-client-id',
  paypalClientSecret: 'pp-client-secret',
  paypalWebhookId: 'WH-123',
};

const HEADERS: Record<string, string> = {
  'paypal-auth-algo': 'SHA256withRSA',
  'paypal-cert-url': 'https://api.paypal.com/cert',
  'paypal-transmission-id': 'tx-123',
  'paypal-transmission-sig': 'sig-abc',
  'paypal-transmission-time': '2024-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('verifyPayPalWebhook', () => {
  it('returns false when PayPal not configured', async () => {
    const secrets: TenantSecrets = {
      telegramBotToken: '123:ABC',
      telegramWebhookSecret: 'test',
    };
    const result = await verifyPayPalWebhook(BASE_URL, HEADERS, '{}', secrets);
    expect(result).toBe(false);
  });

  it('returns true on successful verification', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'tok-123', token_type: 'Bearer' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ verification_status: 'SUCCESS' }),
      });

    const result = await verifyPayPalWebhook(BASE_URL, HEADERS, '{"event_type":"test"}', TENANT_SECRETS);
    expect(result).toBe(true);

    const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toHaveLength(2);
    // First call is token request
    expect(calls[0][0]).toBe('https://api-m.paypal.com/v1/oauth2/token');
    // Second call is verification
    expect(calls[1][0]).toBe('https://api-m.paypal.com/v1/notifications/verify-webhook-signature');
  });

  it('returns false on FAILURE verification', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'tok-123', token_type: 'Bearer' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ verification_status: 'FAILURE' }),
      });

    const result = await verifyPayPalWebhook(BASE_URL, HEADERS, '{}', TENANT_SECRETS);
    expect(result).toBe(false);
  });

  it('returns false when verification endpoint returns error', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'tok-123', token_type: 'Bearer' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

    const result = await verifyPayPalWebhook(BASE_URL, HEADERS, '{}', TENANT_SECRETS);
    expect(result).toBe(false);
  });

  it('throws when token request fails', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    await expect(verifyPayPalWebhook(BASE_URL, HEADERS, '{}', TENANT_SECRETS)).rejects.toThrow('PayPal token request failed');
  });

  describe('local mode bypass', () => {
    const originalEnv = process.env.SKIP_PAYPAL_SIGNATURE_VERIFY;

    afterEach(() => {
      if (originalEnv === undefined) {
        delete process.env.SKIP_PAYPAL_SIGNATURE_VERIFY;
      } else {
        process.env.SKIP_PAYPAL_SIGNATURE_VERIFY = originalEnv;
      }
    });

    it('bypasses verification when SKIP_PAYPAL_SIGNATURE_VERIFY is set', async () => {
      process.env.SKIP_PAYPAL_SIGNATURE_VERIFY = 'true';

      // Don't mock fetch - should not be called
      global.fetch = vi.fn();

      const result = await verifyPayPalWebhook(BASE_URL, HEADERS, '{}', TENANT_SECRETS);
      expect(result).toBe(true);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
