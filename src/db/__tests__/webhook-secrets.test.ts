import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { getTenantIdByWebhookSecret } from '../webhook-secrets.js';
import { MESHQL_URL } from '../client.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getTenantIdByWebhookSecret', () => {
  it('returns tenantId when found', async () => {
    const tenant = {
      id: 'tenant-1',
      display_name: 'Test',
      webhook_secret: 'secret-123',
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { getByWebhookSecret: tenant } }),
    });

    const result = await getTenantIdByWebhookSecret('secret-123');
    expect(result).toBe('tenant-1');

    expect(mockFetch).toHaveBeenCalledWith(
      `${MESHQL_URL}/tenant/graph`,
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('returns null when not found', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { getByWebhookSecret: null } }),
    });

    const result = await getTenantIdByWebhookSecret('unknown');
    expect(result).toBeNull();
  });
});
