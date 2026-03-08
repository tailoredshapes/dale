import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { getTenantByStripeCustomer, createUserRoomMapping } from '../stripe-mappings.js';
import { MESHQL_URL } from '../client.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

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
  it('creates user room via REST POST when no existing record', async () => {
    // First call: getUserRoom GraphQL query - returns null (no existing record)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { getByTenantUserRoom: null } }),
    });

    // Second call: REST POST to create new record
    const created = {
      id: 'meshql-generated-uuid',
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

    // Verify POST was called (second call)
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[1][0]).toBe(`${MESHQL_URL}/user_room/api`);
    expect(mockFetch.mock.calls[1][1].method).toBe('POST');

    const body = JSON.parse(mockFetch.mock.calls[1][1].body);
    // No id field should be sent
    expect(body.id).toBeUndefined();
    expect(body.tenant_id).toBe('t1');
    expect(body.room_id).toBe('r1');
    expect(body.telegram_user_id).toBe(123);
    expect(body.stripe_customer_id).toBe('cus_abc');
    expect(body.stripe_subscription_id).toBe('sub_xyz');
    expect(body.subscription_status).toBe('active');
  });

  it('updates existing record via REST PUT when resubscribing', async () => {
    // First call: getUserRoom GraphQL query - returns existing cancelled record
    const existing = {
      id: 'existing-uuid',
      tenant_id: 't1',
      room_id: 'r1',
      telegram_user_id: 123,
      stripe_customer_id: 'cus_old',
      stripe_subscription_id: 'sub_old',
      subscription_status: 'cancelled',
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { getByTenantUserRoom: existing } }),
    });

    // Second call: REST PUT to update existing record
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...existing, subscription_status: 'active' }),
    });

    await createUserRoomMapping('t1', 123, 'r1', 'cus_new', 'sub_new');

    // Verify PUT was called (second call)
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[1][0]).toBe(`${MESHQL_URL}/user_room/api/existing-uuid`);
    expect(mockFetch.mock.calls[1][1].method).toBe('PUT');

    const body = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(body.stripe_customer_id).toBe('cus_new');
    expect(body.stripe_subscription_id).toBe('sub_new');
    expect(body.subscription_status).toBe('active');
  });

  it('includes optional firstName and username on create', async () => {
    // First call: getUserRoom GraphQL query - returns null
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { getByTenantUserRoom: null } }),
    });

    // Second call: REST POST
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    await createUserRoomMapping('t1', 123, 'r1', 'cus_abc', 'sub_xyz', 'John', 'johndoe');

    const body = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(body.telegram_first_name).toBe('John');
    expect(body.telegram_username).toBe('johndoe');
  });

  it('includes optional firstName and username on update', async () => {
    // First call: getUserRoom GraphQL query - returns existing record
    const existing = {
      id: 'existing-uuid',
      tenant_id: 't1',
      room_id: 'r1',
      telegram_user_id: 123,
      subscription_status: 'cancelled',
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { getByTenantUserRoom: existing } }),
    });

    // Second call: REST PUT
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    await createUserRoomMapping('t1', 123, 'r1', 'cus_abc', 'sub_xyz', 'John', 'johndoe');

    const body = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(body.telegram_first_name).toBe('John');
    expect(body.telegram_username).toBe('johndoe');
  });
});
