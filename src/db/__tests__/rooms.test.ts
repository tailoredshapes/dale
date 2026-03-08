import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createRoom, getRoom, getRoomById, listRoomsForTenant, getRoomByTelegramGroupId, updateRoom } from '../rooms.js';
import { MESHQL_URL } from '../client.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createRoom', () => {
  it('creates room via REST POST', async () => {
    const room = {
      id: 'room-1',
      tenant_id: 'tenant-1',
      name: 'VIP Room',
      payment_link: 'https://buy.stripe.com/test',
      active: true,
      telegram_group_id: '-100123',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => room,
    });

    const result = await createRoom({
      id: 'room-1',
      tenant_id: 'tenant-1',
      name: 'VIP Room',
      payment_link: 'https://buy.stripe.com/test',
      active: true,
      telegram_group_id: '-100123',
    });

    expect(result).toEqual(room);
    expect(mockFetch).toHaveBeenCalledWith(
      `${MESHQL_URL}/room/api`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  it('creates room without telegram group', async () => {
    const room = {
      id: 'room-2',
      tenant_id: 'tenant-1',
      name: 'New Room',
      payment_link: 'https://buy.stripe.com/test',
      active: true,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => room,
    });

    const result = await createRoom({
      id: 'room-2',
      tenant_id: 'tenant-1',
      name: 'New Room',
      payment_link: 'https://buy.stripe.com/test',
      active: true,
    });

    expect(result.telegram_group_id).toBeUndefined();
  });
});

describe('getRoom', () => {
  it('returns room when found and tenant matches', async () => {
    const room = { id: 'r1', tenant_id: 't1', name: 'Test' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => room,
    });

    const result = await getRoom('t1', 'r1');
    expect(result).toEqual(room);
    expect(mockFetch).toHaveBeenCalledWith(`${MESHQL_URL}/room/api/r1`);
  });

  it('returns null when tenant does not match', async () => {
    const room = { id: 'r1', tenant_id: 'other-tenant', name: 'Test' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => room,
    });

    const result = await getRoom('t1', 'r1');
    expect(result).toBeNull();
  });

  it('returns null when not found (404)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const result = await getRoom('t1', 'missing');
    expect(result).toBeNull();
  });
});

describe('getRoomById', () => {
  it('returns room via REST GET', async () => {
    const room = { id: 'r1', tenant_id: 't1', name: 'Test' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => room,
    });

    const result = await getRoomById('r1');
    expect(result).toEqual(room);
    expect(mockFetch).toHaveBeenCalledWith(`${MESHQL_URL}/room/api/r1`);
  });
});

describe('listRoomsForTenant', () => {
  it('returns rooms via GraphQL', async () => {
    const rooms = [
      { id: 'r1', tenant_id: 't1', name: 'Room 1' },
      { id: 'r2', tenant_id: 't1', name: 'Room 2' },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { getByTenantId: rooms } }),
    });

    const result = await listRoomsForTenant('t1');
    expect(result).toHaveLength(2);

    expect(mockFetch).toHaveBeenCalledWith(
      `${MESHQL_URL}/room/graph`,
      expect.objectContaining({
        method: 'POST',
      }),
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.variables).toEqual({ tenant_id: 't1' });
  });

  it('returns empty array when none found', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { getByTenantId: null } }),
    });

    const result = await listRoomsForTenant('t1');
    expect(result).toEqual([]);
  });
});

describe('getRoomByTelegramGroupId', () => {
  it('queries GraphQL for telegram group', async () => {
    const room = { id: 'r1', tenant_id: 't1', telegram_group_id: '-100123' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { getByTelegramGroupId: room } }),
    });

    const result = await getRoomByTelegramGroupId(-100123);
    expect(result).toEqual(room);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.variables).toEqual({ telegram_group_id: '-100123' });
  });

  it('returns null when not found', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { getByTelegramGroupId: null } }),
    });

    const result = await getRoomByTelegramGroupId(-999);
    expect(result).toBeNull();
  });
});

describe('updateRoom', () => {
  it('updates room via REST PUT after verifying tenant', async () => {
    const existing = { id: 'r1', tenant_id: 't1', name: 'Old', active: true };
    const updated = { id: 'r1', tenant_id: 't1', name: 'Updated', active: false };

    // First call: REST GET to verify tenant
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => existing,
    });

    // Second call: REST PUT to update
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => updated,
    });

    const result = await updateRoom('t1', 'r1', { name: 'Updated', active: false });
    expect(result).toEqual(updated);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[1][0]).toBe(`${MESHQL_URL}/room/api/r1`);
    expect(mockFetch.mock.calls[1][1].method).toBe('PUT');
  });

  it('throws when room not found for tenant', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    await expect(updateRoom('t1', 'r1', { name: 'Updated' }))
      .rejects.toThrow('Room r1 not found for tenant t1');
  });

  it('throws when tenant does not match', async () => {
    const room = { id: 'r1', tenant_id: 'other-tenant', name: 'Test' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => room,
    });

    await expect(updateRoom('t1', 'r1', { name: 'Updated' }))
      .rejects.toThrow('Room r1 not found for tenant t1');
  });
});
