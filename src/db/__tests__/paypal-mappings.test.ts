import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { getTenantByPayPalPayer, createPayPalUserRoomMapping } from '../paypal-mappings.js';
import { MESHQL_URL } from '../client.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'mock-uuid-5678',
}));

beforeEach(() => {
  mockFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getTenantByPayPalPayer', () => {
  it('queries GraphQL and returns mapping', async () => {
    const userRoom = {
      id: 'ur-1',
      tenant_id: 't1',
      telegram_user_id: 123,
      paypal_payer_id: 'PP-123',
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { getByPaypalPayerId: userRoom } }),
    });

    const result = await getTenantByPayPalPayer('PP-123');
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
    expect(body.variables).toEqual({ paypal_payer_id: 'PP-123' });
  });

  it('returns null when not found', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { getByPaypalPayerId: null } }),
    });

    const result = await getTenantByPayPalPayer('PP-unknown');
    expect(result).toBeNull();
  });
});

describe('createPayPalUserRoomMapping', () => {
  it('creates user room via REST POST with paypal fields', async () => {
    const created = {
      id: 'mock-uuid-5678',
      tenant_id: 't1',
      room_id: 'r1',
      telegram_user_id: 123,
      paypal_payer_id: 'PP-123',
      paypal_subscription_id: 'I-SUB456',
      subscription_status: 'active',
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => created,
    });

    await createPayPalUserRoomMapping('t1', 123, 'r1', 'PP-123', 'I-SUB456');

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
    expect(body.paypal_payer_id).toBe('PP-123');
    expect(body.paypal_subscription_id).toBe('I-SUB456');
    expect(body.subscription_status).toBe('active');
  });

  it('includes optional firstName and username', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    await createPayPalUserRoomMapping('t1', 123, 'r1', 'PP-123', 'I-SUB456', 'Jane', 'janedoe');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.telegram_first_name).toBe('Jane');
    expect(body.telegram_username).toBe('janedoe');
  });
});
