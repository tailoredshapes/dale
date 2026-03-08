import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createTenant, getTenantById, getTenantByWebhookSecret, updateTenant } from '../tenants.js';
import { MESHQL_URL } from '../client.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createTenant', () => {
  it('creates tenant via REST POST', async () => {
    const tenant = {
      id: 'tenant-1',
      display_name: 'Test Creator',
      webhook_secret: 'secret-123',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => tenant,
    });

    const result = await createTenant({
      id: 'tenant-1',
      display_name: 'Test Creator',
      webhook_secret: 'secret-123',
    });

    expect(result).toEqual(tenant);
    expect(mockFetch).toHaveBeenCalledWith(
      `${MESHQL_URL}/tenant/api`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.id).toBe('tenant-1');
    expect(body.display_name).toBe('Test Creator');
  });
});

describe('getTenantById', () => {
  it('returns tenant via REST GET', async () => {
    const tenant = {
      id: 'tenant-1',
      display_name: 'Test',
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => tenant,
    });

    const result = await getTenantById('tenant-1');
    expect(result).toEqual(tenant);
    expect(mockFetch).toHaveBeenCalledWith(`${MESHQL_URL}/tenant/api/tenant-1`);
  });

  it('returns null when not found (404)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const result = await getTenantById('missing');
    expect(result).toBeNull();
  });
});

describe('getTenantByWebhookSecret', () => {
  it('queries GraphQL and returns tenant', async () => {
    const tenant = {
      id: 'tenant-1',
      display_name: 'Test',
      webhook_secret: 'secret-123',
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { getByWebhookSecret: tenant } }),
    });

    const result = await getTenantByWebhookSecret('secret-123');
    expect(result).toEqual(tenant);

    expect(mockFetch).toHaveBeenCalledWith(
      `${MESHQL_URL}/tenant/graph`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.variables).toEqual({ webhook_secret: 'secret-123' });
  });

  it('returns null when not found', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { getByWebhookSecret: null } }),
    });

    const result = await getTenantByWebhookSecret('missing');
    expect(result).toBeNull();
  });
});

describe('updateTenant', () => {
  it('updates tenant via REST PUT', async () => {
    const updated = {
      id: 'tenant-1',
      display_name: 'New Name',
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => updated,
    });

    const result = await updateTenant('tenant-1', { display_name: 'New Name' });
    expect(result).toEqual(updated);

    expect(mockFetch).toHaveBeenCalledWith(
      `${MESHQL_URL}/tenant/api/tenant-1`,
      expect.objectContaining({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.display_name).toBe('New Name');
  });
});
