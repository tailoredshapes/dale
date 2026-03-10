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
  it('returns rooms list with all fields', async () => {
    mockedListRooms.mockResolvedValue([
      {
        id: 'r1',
        tenant_id: 'tenant-1',
        name: 'VIP',
        description: 'VIP room',
        telegram_group_id: '12345',
        payment_link: 'https://pay',
        paypal_payment_link: 'https://paypal',
        price_description: '$10/month',
        active: true,
      },
    ]);

    const result = await handleListRooms(AUTH);
    expect(result.statusCode).toBe(200);
    const rooms = JSON.parse(result.body);
    expect(rooms).toHaveLength(1);
    expect(rooms[0].roomId).toBe('r1');
    expect(rooms[0].name).toBe('VIP');
    expect(rooms[0].description).toBe('VIP room');
    expect(rooms[0].telegramGroupId).toBe('12345');
    expect(rooms[0].paymentLink).toBe('https://pay');
    expect(rooms[0].paypalPaymentLink).toBe('https://paypal');
    expect(rooms[0].priceDescription).toBe('$10/month');
    expect(rooms[0].isActive).toBe(true);
  });

  it('returns multiple rooms (E2E: List rooms returns all created rooms)', async () => {
    mockedListRooms.mockResolvedValue([
      { id: 'r1', tenant_id: 'tenant-1', name: 'Room One', payment_link: 'https://pay', active: true },
      { id: 'r2', tenant_id: 'tenant-1', name: 'Room Two', payment_link: 'https://pay', active: true },
      { id: 'r3', tenant_id: 'tenant-1', name: 'Room Three', payment_link: 'https://pay', active: true },
    ]);

    const result = await handleListRooms(AUTH);
    expect(result.statusCode).toBe(200);
    const rooms = JSON.parse(result.body);
    expect(rooms).toHaveLength(3);
  });

  it('returns empty array when no rooms (E2E: Delete room removes it from list)', async () => {
    mockedListRooms.mockResolvedValue([]);

    const result = await handleListRooms(AUTH);
    expect(result.statusCode).toBe(200);
    const rooms = JSON.parse(result.body);
    expect(rooms).toHaveLength(0);
  });
});

describe('handleGetRoom', () => {
  it('returns room detail with all fields (E2E: Get room by ID)', async () => {
    mockedGetRoom.mockResolvedValue({
      id: 'r1',
      tenant_id: 'tenant-1',
      name: 'Specific Room',
      description: 'A test room',
      telegram_group_id: '12345',
      payment_link: 'https://pay',
      paypal_payment_link: 'https://paypal',
      price_description: '$10/month',
      active: true,
    });

    const result = await handleGetRoom(AUTH, 'r1');
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.roomId).toBe('r1');
    expect(body.name).toBe('Specific Room');
    expect(body.description).toBe('A test room');
    expect(body.telegramGroupId).toBe('12345');
    expect(body.paymentLink).toBe('https://pay');
    expect(body.paypalPaymentLink).toBe('https://paypal');
    expect(body.priceDescription).toBe('$10/month');
    expect(body.isActive).toBe(true);
  });

  it('returns room with isActive false for inactive room', async () => {
    mockedGetRoom.mockResolvedValue({
      id: 'r1',
      tenant_id: 'tenant-1',
      name: 'Inactive Room',
      payment_link: '',
      active: false,
    });

    const result = await handleGetRoom(AUTH, 'r1');
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.isActive).toBe(false);
  });

  it('returns 404 when not found (E2E: Get non-existent room)', async () => {
    mockedGetRoom.mockResolvedValue(null);
    const result = await handleGetRoom(AUTH, 'nonexistent-room-id');
    expect(result.statusCode).toBe(404);
  });
});

describe('handleCreateRoom', () => {
  it('creates room with all fields (E2E: Create room with all fields)', async () => {
    mockedCreateRoom.mockResolvedValue({
      id: 'meshql-full-room',
      tenant_id: 'tenant-1',
      name: 'Full Room',
      description: 'A fully-spec\'d room',
      payment_link: 'https://buy.stripe.com/full',
      price_description: '$10/month',
      active: true,
    });

    const result = await handleCreateRoom(AUTH, JSON.stringify({
      name: 'Full Room',
      description: 'A fully-spec\'d room',
      paymentLink: 'https://buy.stripe.com/full',
      priceDescription: '$10/month',
    }));

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.roomId).toBe('meshql-full-room');
    expect(body.name).toBe('Full Room');

    expect(mockedCreateRoom).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Full Room',
      description: 'A fully-spec\'d room',
      payment_link: 'https://buy.stripe.com/full',
      price_description: '$10/month',
      active: true,
    }));
  });

  it('creates room with minimal fields (E2E: Create room with minimal fields)', async () => {
    mockedCreateRoom.mockResolvedValue({
      id: 'meshql-minimal-room',
      tenant_id: 'tenant-1',
      name: 'Minimal Room',
      payment_link: '',
      active: false,
    });

    const result = await handleCreateRoom(AUTH, JSON.stringify({
      name: 'Minimal Room',
    }));

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.roomId).toBe('meshql-minimal-room');

    // Room defaults to active: true
    expect(mockedCreateRoom).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Minimal Room',
      active: true,
    }));
  });

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

  it('creates room without payment link (defaults to active) (E2E: Room is active by default)', async () => {
    mockedCreateRoom.mockResolvedValue({
      id: 'meshql-no-link-room',
      tenant_id: 'tenant-1',
      name: 'No Link Room',
      payment_link: '',
      active: true,
    });

    const result = await handleCreateRoom(AUTH, JSON.stringify({ name: 'No Link Room' }));
    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.roomId).toBe('meshql-no-link-room');

    // Verify room was created with active: true (default)
    expect(mockedCreateRoom).toHaveBeenCalledWith(expect.objectContaining({
      name: 'No Link Room',
      active: true,
    }));
  });
});

describe('handleUpdateRoom', () => {
  it('updates room name (E2E: Update room name)', async () => {
    mockedGetRoom.mockResolvedValue({
      id: 'r1',
      tenant_id: 'tenant-1',
      name: 'Old Name',
      payment_link: 'https://pay',
      active: true,
    });
    mockedUpdateRoom.mockResolvedValue({
      id: 'r1',
      tenant_id: 'tenant-1',
      name: 'New Name',
      active: true,
    });

    const result = await handleUpdateRoom(AUTH, 'r1', JSON.stringify({ name: 'New Name' }));
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.updated).toBe(true);

    expect(mockedUpdateRoom).toHaveBeenCalledWith('tenant-1', 'r1', { name: 'New Name' });
  });

  it('updates room with payment link and activates it (E2E: Update room payment link activates it)', async () => {
    mockedGetRoom.mockResolvedValue({
      id: 'r1',
      tenant_id: 'tenant-1',
      name: 'Inactive Room',
      payment_link: '',
      active: false,
    });
    mockedUpdateRoom.mockResolvedValue({
      id: 'r1',
      tenant_id: 'tenant-1',
      name: 'Inactive Room',
      payment_link: 'https://buy.stripe.com/activated',
      active: true,
    });

    const result = await handleUpdateRoom(AUTH, 'r1', JSON.stringify({
      paymentLink: 'https://buy.stripe.com/activated',
      isActive: true,
    }));
    expect(result.statusCode).toBe(200);

    expect(mockedUpdateRoom).toHaveBeenCalledWith('tenant-1', 'r1', {
      payment_link: 'https://buy.stripe.com/activated',
      active: true,
    });
  });

  it('updates all room fields', async () => {
    mockedGetRoom.mockResolvedValue({
      id: 'r1',
      tenant_id: 'tenant-1',
      name: 'Original',
      payment_link: 'https://pay',
      active: true,
    });
    mockedUpdateRoom.mockResolvedValue({
      id: 'r1',
      tenant_id: 'tenant-1',
      name: 'Updated',
      active: true,
    });

    const result = await handleUpdateRoom(AUTH, 'r1', JSON.stringify({
      name: 'Updated Name',
      description: 'Updated Description',
      paymentLink: 'https://new-pay',
      paypalPaymentLink: 'https://new-paypal',
      priceDescription: '$20/month',
      isActive: false,
    }));
    expect(result.statusCode).toBe(200);

    expect(mockedUpdateRoom).toHaveBeenCalledWith('tenant-1', 'r1', {
      name: 'Updated Name',
      description: 'Updated Description',
      payment_link: 'https://new-pay',
      paypal_payment_link: 'https://new-paypal',
      price_description: '$20/month',
      active: false,
    });
  });

  it('returns 400 for invalid JSON', async () => {
    mockedGetRoom.mockResolvedValue({
      id: 'r1',
      tenant_id: 'tenant-1',
      name: 'Room',
      payment_link: 'https://pay',
      active: true,
    });
    const result = await handleUpdateRoom(AUTH, 'r1', 'bad');
    expect(result.statusCode).toBe(400);
  });

  it('returns 404 when room not found (E2E: Tenant B cannot PUT Tenant A room)', async () => {
    mockedGetRoom.mockResolvedValue(null);
    const result = await handleUpdateRoom(AUTH, 'tenant-a-room', JSON.stringify({ name: 'Hijacked' }));
    expect(result.statusCode).toBe(404);
    expect(mockedUpdateRoom).not.toHaveBeenCalled();
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
