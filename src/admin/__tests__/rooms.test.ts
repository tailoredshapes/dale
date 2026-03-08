import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/rooms.js', () => ({
  // createRoom returns the room with a meshql-rs generated ID
  createRoom: vi.fn().mockImplementation(async (room) => ({ id: 'meshql-room-uuid', ...room })),
  getRoom: vi.fn(),
  listRoomsForTenant: vi.fn(),
  updateRoom: vi.fn(),
  deleteRoom: vi.fn(),
}));

import { handleListRooms, handleGetRoom, handleCreateRoom, handleUpdateRoom, handleDeleteRoom } from '../routes/rooms.js';
import { getRoom, listRoomsForTenant, createRoom, updateRoom, deleteRoom } from '../../db/rooms.js';

const mockedGetRoom = vi.mocked(getRoom);
const mockedListRooms = vi.mocked(listRoomsForTenant);
const mockedCreateRoom = vi.mocked(createRoom);
const mockedUpdateRoom = vi.mocked(updateRoom);
const mockedDeleteRoom = vi.mocked(deleteRoom);

const AUTH = { tenantId: 'tenant-1' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('handleListRooms', () => {
  it('returns rooms list', async () => {
    mockedListRooms.mockResolvedValue([
      {
        id: 'r1',
        tenant_id: 'tenant-1',
        name: 'VIP',
        payment_link: 'https://pay',
        active: true,
      },
    ]);

    const result = await handleListRooms(AUTH);
    expect(result.statusCode).toBe(200);
    const rooms = JSON.parse(result.body);
    expect(rooms).toHaveLength(1);
    expect(rooms[0].roomId).toBe('r1');
  });
});

describe('handleGetRoom', () => {
  it('returns room detail', async () => {
    mockedGetRoom.mockResolvedValue({
      id: 'r1',
      tenant_id: 'tenant-1',
      name: 'VIP',
      payment_link: 'https://pay',
      active: true,
    });

    const result = await handleGetRoom(AUTH, 'r1');
    expect(result.statusCode).toBe(200);
  });

  it('returns 404 when not found', async () => {
    mockedGetRoom.mockResolvedValue(null);
    const result = await handleGetRoom(AUTH, 'missing');
    expect(result.statusCode).toBe(404);
  });
});

describe('handleCreateRoom', () => {
  it('creates room with Stripe link and returns roomId from restlette', async () => {
    mockedCreateRoom.mockResolvedValue({
      id: 'meshql-room-uuid',
      tenant_id: 'tenant-1',
      name: 'New Room',
      payment_link: 'https://pay',
      active: true,
    });

    const result = await handleCreateRoom(AUTH, JSON.stringify({
      name: 'New Room',
      paymentLink: 'https://pay',
    }));
    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    // Should use the ID returned from createRoom (meshql-rs generated)
    expect(body.roomId).toBe('meshql-room-uuid');
  });

  it('creates room with PayPal link only', async () => {
    mockedCreateRoom.mockResolvedValue({
      id: 'meshql-paypal-room',
      tenant_id: 'tenant-1',
      name: 'PayPal Room',
      payment_link: '',
      paypal_payment_link: 'https://paypal.com/subscribe?plan_id=P-123',
      active: true,
    });

    const result = await handleCreateRoom(AUTH, JSON.stringify({
      name: 'PayPal Room',
      paypalPaymentLink: 'https://paypal.com/subscribe?plan_id=P-123',
    }));
    expect(result.statusCode).toBe(201);
  });

  it('creates room with both links', async () => {
    mockedCreateRoom.mockResolvedValue({
      id: 'meshql-both-room',
      tenant_id: 'tenant-1',
      name: 'Both Room',
      payment_link: 'https://stripe-pay',
      paypal_payment_link: 'https://paypal-pay',
      active: true,
    });

    const result = await handleCreateRoom(AUTH, JSON.stringify({
      name: 'Both Room',
      paymentLink: 'https://stripe-pay',
      paypalPaymentLink: 'https://paypal-pay',
    }));
    expect(result.statusCode).toBe(201);
  });

  it('creates room without payment link (starts inactive)', async () => {
    mockedCreateRoom.mockResolvedValue({
      id: 'meshql-no-link-room',
      tenant_id: 'tenant-1',
      name: 'No Link Room',
      payment_link: '',
      active: false,
    });

    const result = await handleCreateRoom(AUTH, JSON.stringify({ name: 'No Link Room' }));
    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.roomId).toBe('meshql-no-link-room');

    // Verify room was created with active: false
    expect(mockedCreateRoom).toHaveBeenCalledWith(expect.objectContaining({
      name: 'No Link Room',
      active: false,
    }));
  });
});

describe('handleUpdateRoom', () => {
  it('updates room', async () => {
    mockedUpdateRoom.mockResolvedValue({
      id: 'r1',
      tenant_id: 'tenant-1',
      name: 'Updated',
      active: true,
    });

    const result = await handleUpdateRoom(AUTH, 'r1', JSON.stringify({ name: 'Updated' }));
    expect(result.statusCode).toBe(200);
  });

  it('returns 400 for invalid JSON', async () => {
    const result = await handleUpdateRoom(AUTH, 'r1', 'bad');
    expect(result.statusCode).toBe(400);
  });
});

describe('handleDeleteRoom', () => {
  it('deletes room and returns 200', async () => {
    mockedGetRoom.mockResolvedValue({
      id: 'r1',
      tenant_id: 'tenant-1',
      name: 'To Delete',
      payment_link: 'https://pay',
      active: true,
    });
    mockedDeleteRoom.mockResolvedValue(undefined);

    const result = await handleDeleteRoom(AUTH, 'r1');
    expect(result.statusCode).toBe(200);
    expect(mockedDeleteRoom).toHaveBeenCalledWith('tenant-1', 'r1');
  });

  it('returns 404 when room not found', async () => {
    mockedGetRoom.mockResolvedValue(null);
    const result = await handleDeleteRoom(AUTH, 'missing');
    expect(result.statusCode).toBe(404);
  });
});
