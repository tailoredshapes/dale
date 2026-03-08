import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { getUserRoom, listUserRooms, listRoomSubscribers, updateUserRoomStatus, createUserRoom, getUserRoomById } from '../users.js';
import { MESHQL_URL } from '../client.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getUserRoom', () => {
  it('returns user room when found via GraphQL', async () => {
    const userRoom = {
      id: 'ur-1',
      tenant_id: 't1',
      room_id: 'r1',
      telegram_user_id: 123,
      subscription_status: 'active',
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { getByTenantUserRoom: userRoom } }),
    });

    const result = await getUserRoom('t1', 123, 'r1');
    expect(result).toEqual(userRoom);

    expect(mockFetch).toHaveBeenCalledWith(
      `${MESHQL_URL}/user_room/graph`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.variables).toEqual({ tenant_id: 't1', telegram_user_id: 123, room_id: 'r1' });
  });

  it('returns null when not found', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { getByTenantUserRoom: null } }),
    });

    const result = await getUserRoom('t1', 123, 'missing');
    expect(result).toBeNull();
  });
});

describe('listUserRooms', () => {
  it('returns user rooms via GraphQL', async () => {
    const rooms = [
      { id: 'ur-1', tenant_id: 't1', room_id: 'r1', telegram_user_id: 123 },
      { id: 'ur-2', tenant_id: 't1', room_id: 'r2', telegram_user_id: 123 },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { getByTenantAndUser: rooms } }),
    });

    const result = await listUserRooms('t1', 123);
    expect(result).toHaveLength(2);
    expect(result).toEqual(rooms);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.variables).toEqual({ tenant_id: 't1', telegram_user_id: 123 });
  });

  it('returns empty array when none found', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { getByTenantAndUser: null } }),
    });

    const result = await listUserRooms('t1', 123);
    expect(result).toEqual([]);
  });
});

describe('listRoomSubscribers', () => {
  it('returns subscribers for a room via GraphQL', async () => {
    const items = [
      { id: 'ur-1', tenant_id: 't1', room_id: 'r1', telegram_user_id: 123 },
      { id: 'ur-2', tenant_id: 't1', room_id: 'r1', telegram_user_id: 456 },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { getByTenantAndRoom: items } }),
    });

    const result = await listRoomSubscribers('t1', 'r1');
    expect(result).toHaveLength(2);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.variables).toEqual({ tenant_id: 't1', room_id: 'r1' });
  });
});

describe('updateUserRoomStatus', () => {
  it('updates status via REST PUT after finding existing record', async () => {
    const existing = {
      id: 'ur-1',
      tenant_id: 't1',
      room_id: 'r1',
      telegram_user_id: 123,
      subscription_status: 'active',
    };

    // First call: GraphQL to find existing
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { getByTenantUserRoom: existing } }),
    });

    // Second call: REST PUT to update
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...existing, subscription_status: 'past_due' }),
    });

    await updateUserRoomStatus('t1', 123, 'r1', 'past_due');

    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Verify PUT call
    expect(mockFetch.mock.calls[1][0]).toBe(`${MESHQL_URL}/user_room/api/ur-1`);
    expect(mockFetch.mock.calls[1][1].method).toBe('PUT');
    const putBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(putBody.subscription_status).toBe('past_due');
  });

  it('updates status with stripeSubscriptionId', async () => {
    const existing = {
      id: 'ur-1',
      tenant_id: 't1',
      room_id: 'r1',
      telegram_user_id: 123,
      subscription_status: 'active',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { getByTenantUserRoom: existing } }),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...existing, subscription_status: 'active', stripe_subscription_id: 'sub_new' }),
    });

    await updateUserRoomStatus('t1', 123, 'r1', 'active', 'sub_new');

    const putBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(putBody.stripe_subscription_id).toBe('sub_new');
    expect(putBody.subscription_status).toBe('active');
  });

  it('throws when user room not found', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { getByTenantUserRoom: null } }),
    });

    await expect(updateUserRoomStatus('t1', 123, 'r1', 'past_due'))
      .rejects.toThrow('UserRoom not found');
  });
});

describe('createUserRoom', () => {
  it('creates user room via REST POST (no id field)', async () => {
    // Input without id - meshql-rs will generate one
    const input = {
      tenant_id: 't1',
      room_id: 'r1',
      telegram_user_id: 123,
      subscription_status: 'active' as const,
    };

    // Response includes meshql-generated id
    const created = {
      id: 'meshql-generated-id',
      ...input,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => created,
    });

    const result = await createUserRoom(input);
    expect(result).toEqual(created);

    expect(mockFetch).toHaveBeenCalledWith(
      `${MESHQL_URL}/user_room/api`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });
});

describe('getUserRoomById', () => {
  it('returns user room via REST GET', async () => {
    const userRoom = {
      id: 'ur-1',
      tenant_id: 't1',
      room_id: 'r1',
      telegram_user_id: 123,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => userRoom,
    });

    const result = await getUserRoomById('ur-1');
    expect(result).toEqual(userRoom);
    expect(mockFetch).toHaveBeenCalledWith(`${MESHQL_URL}/user_room/api/ur-1`);
  });

  it('returns null when not found (404)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const result = await getUserRoomById('ur-missing');
    expect(result).toBeNull();
  });
});
