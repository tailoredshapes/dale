import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { getTenantByStripeCustomer, createUserRoomMapping } from '../stripe-mappings.js';
import { MESHQL_URL } from '../client.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'mock-uuid-1234',
}));

beforeEach(() => {
  mockFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getTenantByStripeCustomer', () => {
  it('queries GraphQL and returns mapping', async () => {
    const userRoom = {
      id: 'ur-1',
      tenant_id: 't1',
      telegram_user_id: 123,
      stripe_customer_id: 'cus_abc',
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { getByStripeCustomerId: userRoom } }),
    });

    const result = await getTenantByStripeCustomer('cus_abc');
    expect(result).toEqual({
      tenant_id: 't1',
      telegram_user_id: 123,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      `${MESHQL_URL}/user_room/graph`,
      expect.objectContaining({
        method: 'POST',
      }),
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.variables).toEqual({ stripe_customer_id: 'cus_abc' });
  });

  it('returns null when not found', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { getByStripeCustomerId: null } }),
    });

    const result = await getTenantByStripeCustomer('cus_unknown');
    expect(result).toBeNull();
  });
});

describe('createUserRoomMapping', () => {
  it('creates user room via REST POST with stripe fields', async () => {
    const created = {
      id: 'mock-uuid-1234',
      tenant_id: 't1',
      room_id: 'r1',
      telegram_user_id: 123,
      stripe_customer_id: 'cus_abc',
      stripe_subscription_id: 'sub_xyz',
      subscription_status: 'active',
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => created,
    });

    await createUserRoomMapping('t1', 123, 'r1', 'cus_abc', 'sub_xyz');

    expect(mockFetch).toHaveBeenCalledWith(
      `${MESHQL_URL}/user_room/api`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.tenant_id).toBe('t1');
    expect(body.room_id).toBe('r1');
    expect(body.telegram_user_id).toBe(123);
    expect(body.stripe_customer_id).toBe('cus_abc');
    expect(body.stripe_subscription_id).toBe('sub_xyz');
    expect(body.subscription_status).toBe('active');
  });

  it('includes optional firstName and username', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    await createUserRoomMapping('t1', 123, 'r1', 'cus_abc', 'sub_xyz', 'John', 'johndoe');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.telegram_first_name).toBe('John');
    expect(body.telegram_username).toBe('johndoe');
  });
});
