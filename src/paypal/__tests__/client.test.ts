import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getAccessToken, registerPayPalWebhook, deletePayPalWebhook } from '../client.js';

const originalFetch = global.fetch;
const BASE_URL = 'https://api-m.sandbox.paypal.com';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('getAccessToken', () => {
  it('returns access token on success', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ access_token: 'tok-abc', token_type: 'Bearer' }),
    });

    const token = await getAccessToken(BASE_URL, 'client-id', 'client-secret');
    expect(token).toBe('tok-abc');

    const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][0]).toBe(`${BASE_URL}/v1/oauth2/token`);
  });

  it('throws on failure', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    await expect(getAccessToken(BASE_URL, 'bad', 'bad')).rejects.toThrow('PayPal token request failed: 401');
  });
});

describe('registerPayPalWebhook', () => {
  it('returns mock ID when SKIP_PAYPAL_REGISTRATION is set', async () => {
    const originalSkip = process.env.SKIP_PAYPAL_REGISTRATION;
    process.env.SKIP_PAYPAL_REGISTRATION = 'true';

    try {
      // fetch should NOT be called when skipping registration
      global.fetch = vi.fn();

      const id = await registerPayPalWebhook(
        BASE_URL, 'client-id', 'client-secret',
        'https://webhook.example.com?tenant=t1',
        ['BILLING.SUBSCRIPTION.ACTIVATED'],
      );

      expect(id).toMatch(/^WH-mock-\d+$/);
      expect(global.fetch).not.toHaveBeenCalled();
    } finally {
      // Restore original value
      if (originalSkip === undefined) {
        delete process.env.SKIP_PAYPAL_REGISTRATION;
      } else {
        process.env.SKIP_PAYPAL_REGISTRATION = originalSkip;
      }
    }
  });

  it('gets token then registers webhook, returns ID', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'tok-123', token_type: 'Bearer' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'WH-auto-456', url: 'https://example.com' }),
      });

    const id = await registerPayPalWebhook(
      BASE_URL, 'client-id', 'client-secret',
      'https://webhook.example.com?tenant=t1',
      ['BILLING.SUBSCRIPTION.ACTIVATED', 'PAYMENT.SALE.COMPLETED'],
    );
    expect(id).toBe('WH-auto-456');

    const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][0]).toBe(`${BASE_URL}/v1/oauth2/token`);
    expect(calls[1][0]).toBe(`${BASE_URL}/v1/notifications/webhooks`);

    const body = JSON.parse(calls[1][1].body);
    expect(body.url).toBe('https://webhook.example.com?tenant=t1');
    expect(body.event_types).toEqual([
      { name: 'BILLING.SUBSCRIPTION.ACTIVATED' },
      { name: 'PAYMENT.SALE.COMPLETED' },
    ]);
  });

  it('throws on API error', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'tok-123', token_type: 'Bearer' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 422,
        text: () => Promise.resolve('Webhook URL already exists'),
      });

    await expect(registerPayPalWebhook(
      BASE_URL, 'client-id', 'client-secret',
      'https://webhook.example.com?tenant=t1',
      ['BILLING.SUBSCRIPTION.ACTIVATED'],
    )).rejects.toThrow('PayPal webhook registration failed: 422');
  });
});

describe('deletePayPalWebhook', () => {
  it('gets token then calls DELETE', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'tok-123', token_type: 'Bearer' }),
      })
      .mockResolvedValueOnce({
        ok: true,
      });

    await deletePayPalWebhook(BASE_URL, 'client-id', 'client-secret', 'WH-123');

    const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[1][0]).toBe(`${BASE_URL}/v1/notifications/webhooks/WH-123`);
    expect(calls[1][1].method).toBe('DELETE');
  });

  it('handles 404 gracefully (already deleted)', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'tok-123', token_type: 'Bearer' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

    await expect(deletePayPalWebhook(BASE_URL, 'client-id', 'client-secret', 'WH-gone')).resolves.toBeUndefined();
  });

  it('throws on other errors', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'tok-123', token_type: 'Bearer' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

    await expect(deletePayPalWebhook(BASE_URL, 'client-id', 'client-secret', 'WH-err')).rejects.toThrow('PayPal webhook deletion failed: 500');
  });
});
