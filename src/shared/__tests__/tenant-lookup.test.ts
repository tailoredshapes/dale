import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/tenants.js', () => ({
  getTenantByWebhookSecret: vi.fn(),
}));

import { getTenantIdByWebhookSecret, resetWebhookSecretCache } from '../tenant-lookup.js';
import { getTenantByWebhookSecret } from '../../db/tenants.js';

const mockedGetTenant = vi.mocked(getTenantByWebhookSecret);

beforeEach(() => {
  vi.clearAllMocks();
  resetWebhookSecretCache();
});

describe('getTenantIdByWebhookSecret', () => {
  it('returns tenantId when mapping exists', async () => {
    mockedGetTenant.mockResolvedValue({
      id: 'tenant-1',
      display_name: 'Test Tenant',
      webhook_secret: 'my-secret',
    });

    const result = await getTenantIdByWebhookSecret('my-secret');

    expect(result).toBe('tenant-1');
    expect(mockedGetTenant).toHaveBeenCalledWith('my-secret');
  });

  it('returns null when no mapping found', async () => {
    mockedGetTenant.mockResolvedValue(null);

    const result = await getTenantIdByWebhookSecret('unknown-secret');

    expect(result).toBeNull();
  });

  it('returns cached value on second call', async () => {
    mockedGetTenant.mockResolvedValue({
      id: 'tenant-1',
      display_name: 'Test Tenant',
      webhook_secret: 'sec',
    });

    await getTenantIdByWebhookSecret('sec');
    const result = await getTenantIdByWebhookSecret('sec');

    expect(result).toBe('tenant-1');
    expect(mockedGetTenant).toHaveBeenCalledTimes(1);
  });

  it('does not cache null results', async () => {
    mockedGetTenant
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'tenant-1',
        display_name: 'Test Tenant',
        webhook_secret: 'sec',
      });

    const first = await getTenantIdByWebhookSecret('sec');
    const second = await getTenantIdByWebhookSecret('sec');

    expect(first).toBeNull();
    expect(second).toBe('tenant-1');
    expect(mockedGetTenant).toHaveBeenCalledTimes(2);
  });

  it('caches per secret independently', async () => {
    mockedGetTenant.mockResolvedValue({
      id: 'tenant-1',
      display_name: 'Test Tenant',
      webhook_secret: 'sec',
    });

    await getTenantIdByWebhookSecret('secret-a');
    await getTenantIdByWebhookSecret('secret-b');

    expect(mockedGetTenant).toHaveBeenCalledTimes(2);
  });
});
