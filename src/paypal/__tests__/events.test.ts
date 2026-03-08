import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/paypal-mappings.js', () => ({
  getTenantByPayPalPayer: vi.fn(),
  createPayPalUserRoomMapping: vi.fn(),
}));

vi.mock('../../db/users.js', () => ({
  listUserRooms: vi.fn(),
  updateUserRoomStatus: vi.fn(),
  getUserRoom: vi.fn(),
}));

vi.mock('../../telegram/api.js', () => ({
  sendMessage: vi.fn(),
  banChatMember: vi.fn(),
  unbanChatMember: vi.fn(),
  createChatInviteLink: vi.fn(),
}));

vi.mock('../../db/rooms.js', () => ({
  getRoom: vi.fn(),
}));

import {
  parseCustomId,
  handleSubscriptionActivated,
  handleSubscriptionCancelled,
  handleSubscriptionSuspended,
} from '../events.js';
import { getTenantByPayPalPayer, createPayPalUserRoomMapping } from '../../db/paypal-mappings.js';
import { listUserRooms, updateUserRoomStatus, getUserRoom } from '../../db/users.js';
import { sendMessage, banChatMember, unbanChatMember, createChatInviteLink } from '../../telegram/api.js';
import { getRoom } from '../../db/rooms.js';

const mockedGetMapping = vi.mocked(getTenantByPayPalPayer);
const mockedCreateMapping = vi.mocked(createPayPalUserRoomMapping);
const mockedListUserRooms = vi.mocked(listUserRooms);
const mockedUpdateStatus = vi.mocked(updateUserRoomStatus);
const mockedGetUserRoom = vi.mocked(getUserRoom);
const mockedSendMessage = vi.mocked(sendMessage);
const mockedBanChatMember = vi.mocked(banChatMember);
const mockedUnbanChatMember = vi.mocked(unbanChatMember);
const mockedCreateInviteLink = vi.mocked(createChatInviteLink);
const mockedGetRoom = vi.mocked(getRoom);

const baseUserRoom = {
  id: 'ur-1',
  tenant_id: 'tenant-1',
  telegram_user_id: 123,
  room_id: 'room-1',
  subscription_status: 'active' as const,
  paypal_subscription_id: 'I-SUB456',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('parseCustomId', () => {
  it('parses valid custom_id', () => {
    const result = parseCustomId('tenant-1:123:room-1');
    expect(result).toEqual({ tenantId: 'tenant-1', telegramUserId: 123, roomId: 'room-1' });
  });

  it('returns null for null', () => {
    expect(parseCustomId(null)).toBeNull();
  });

  it('returns null for invalid format', () => {
    expect(parseCustomId('bad-format')).toBeNull();
  });

  it('returns null for wrong number of parts', () => {
    expect(parseCustomId('a:b')).toBeNull();
    expect(parseCustomId('a:b:c:d')).toBeNull();
  });

  it('returns null for non-numeric userId', () => {
    expect(parseCustomId('tenant:abc:room')).toBeNull();
  });
});

describe('handleSubscriptionActivated', () => {
  it('creates mapping and notifies user for new subscription', async () => {
    mockedGetUserRoom.mockResolvedValue(null);  // No existing mapping
    mockedGetRoom.mockResolvedValue(null);
    const event = {
      resource: {
        id: 'I-SUB456',
        custom_id: 'tenant-1:123:room-1',
        subscriber: { payer_id: 'PP-123' },
      },
    };

    await handleSubscriptionActivated('tenant-1', 'bot-token', event);

    expect(mockedCreateMapping).toHaveBeenCalledWith(
      'tenant-1', 123, 'room-1', 'PP-123', 'I-SUB456',
    );
    expect(mockedSendMessage).toHaveBeenCalledWith(
      'bot-token',
      123,
      expect.stringContaining('active'),
    );
  });

  it('updates status for reactivation (existing cancelled subscription)', async () => {
    mockedGetUserRoom.mockResolvedValue({
      ...baseUserRoom,
      subscription_status: 'cancelled',
    });
    mockedGetRoom.mockResolvedValue({
      id: 'room-1',
      tenant_id: 'tenant-1',
      name: 'Cool Club',
      telegram_group_id: '-1001234567890',
      payment_link: 'https://paypal.com/test',
      active: true,
    });
    mockedUnbanChatMember.mockResolvedValue(true);
    mockedCreateInviteLink.mockResolvedValue('https://t.me/+abc123');

    const event = {
      resource: {
        id: 'I-SUB456',
        custom_id: 'tenant-1:123:room-1',
        subscriber: { payer_id: 'PP-123' },
      },
    };

    await handleSubscriptionActivated('tenant-1', 'bot-token', event);

    // Should update existing mapping, not create new
    expect(mockedUpdateStatus).toHaveBeenCalledWith('tenant-1', 123, 'room-1', 'active');
    expect(mockedCreateMapping).not.toHaveBeenCalled();
    expect(mockedUnbanChatMember).toHaveBeenCalledWith('bot-token', -1001234567890, 123);
    expect(mockedSendMessage).toHaveBeenCalledWith(
      'bot-token',
      123,
      expect.stringContaining('https://t.me/+abc123'),
    );
  });

  it('unbans user and creates invite link when room has telegram group', async () => {
    mockedGetUserRoom.mockResolvedValue(null);  // New subscription
    mockedGetRoom.mockResolvedValue({
      id: 'room-1',
      tenant_id: 'tenant-1',
      name: 'Cool Club',
      telegram_group_id: '-1001234567890',
      payment_link: 'https://paypal.com/test',
      active: true,
    });
    mockedUnbanChatMember.mockResolvedValue(true);
    mockedCreateInviteLink.mockResolvedValue('https://t.me/+abc123');

    const event = {
      resource: {
        id: 'I-SUB456',
        custom_id: 'tenant-1:123:room-1',
        subscriber: { payer_id: 'PP-123' },
      },
    };

    await handleSubscriptionActivated('tenant-1', 'bot-token', event);

    expect(mockedUnbanChatMember).toHaveBeenCalledWith('bot-token', -1001234567890, 123);
    expect(mockedCreateInviteLink).toHaveBeenCalledWith('bot-token', -1001234567890);
    expect(mockedSendMessage).toHaveBeenCalledWith(
      'bot-token',
      123,
      expect.stringContaining('https://t.me/+abc123'),
    );
  });

  it('skips if custom_id is invalid', async () => {
    const event = {
      resource: {
        id: 'I-SUB456',
        custom_id: 'bad-format',
        subscriber: { payer_id: 'PP-123' },
      },
    };

    await handleSubscriptionActivated('tenant-1', 'bot-token', event);
    expect(mockedCreateMapping).not.toHaveBeenCalled();
    expect(mockedUpdateStatus).not.toHaveBeenCalled();
  });

  it('skips if tenant mismatch', async () => {
    const event = {
      resource: {
        id: 'I-SUB456',
        custom_id: 'other-tenant:123:room-1',
        subscriber: { payer_id: 'PP-123' },
      },
    };

    await handleSubscriptionActivated('tenant-1', 'bot-token', event);
    expect(mockedCreateMapping).not.toHaveBeenCalled();
    expect(mockedUpdateStatus).not.toHaveBeenCalled();
  });

  it('skips if payer_id is missing', async () => {
    const event = {
      resource: {
        id: 'I-SUB456',
        custom_id: 'tenant-1:123:room-1',
        subscriber: {},
      },
    };

    await handleSubscriptionActivated('tenant-1', 'bot-token', event);
    expect(mockedCreateMapping).not.toHaveBeenCalled();
    expect(mockedUpdateStatus).not.toHaveBeenCalled();
  });
});

describe('handleSubscriptionCancelled', () => {
  it('updates status, bans user, and sends cancellation message', async () => {
    mockedGetMapping.mockResolvedValue({
      tenant_id: 'tenant-1',
      telegram_user_id: 123,
    });
    mockedListUserRooms.mockResolvedValue([baseUserRoom]);
    mockedGetRoom.mockResolvedValue({
      id: 'room-1',
      tenant_id: 'tenant-1',
      name: 'Cool Club',
      telegram_group_id: '-1001234567890',
      payment_link: 'https://paypal.com/test',
      active: true,
    });
    mockedBanChatMember.mockResolvedValue(true);

    const event = {
      resource: {
        id: 'I-SUB456',
        subscriber: { payer_id: 'PP-123' },
      },
    };

    await handleSubscriptionCancelled('tenant-1', 'bot-token', event);

    expect(mockedUpdateStatus).toHaveBeenCalledWith('tenant-1', 123, 'room-1', 'cancelled');
    expect(mockedBanChatMember).toHaveBeenCalledWith('bot-token', -1001234567890, 123);
    expect(mockedSendMessage).toHaveBeenCalledWith(
      'bot-token',
      123,
      expect.stringContaining('cancelled'),
    );
  });

  it('skips if no mapping found', async () => {
    mockedGetMapping.mockResolvedValue(null);
    const event = {
      resource: {
        id: 'I-SUB456',
        subscriber: { payer_id: 'PP-unknown' },
      },
    };

    await handleSubscriptionCancelled('tenant-1', 'bot-token', event);
    expect(mockedSendMessage).not.toHaveBeenCalled();
    expect(mockedUpdateStatus).not.toHaveBeenCalled();
  });
});

describe('handleSubscriptionSuspended', () => {
  it('updates status to past_due and sends message', async () => {
    mockedGetMapping.mockResolvedValue({
      tenant_id: 'tenant-1',
      telegram_user_id: 123,
    });
    mockedListUserRooms.mockResolvedValue([baseUserRoom]);

    const event = {
      resource: {
        id: 'I-SUB456',
        subscriber: { payer_id: 'PP-123' },
      },
    };

    await handleSubscriptionSuspended('tenant-1', 'bot-token', event);

    expect(mockedUpdateStatus).toHaveBeenCalledWith('tenant-1', 123, 'room-1', 'past_due');
    expect(mockedSendMessage).toHaveBeenCalledWith(
      'bot-token',
      123,
      expect.stringContaining('past due'),
    );
  });

  it('skips if no mapping found', async () => {
    mockedGetMapping.mockResolvedValue(null);
    const event = {
      resource: {
        id: 'I-SUB456',
        subscriber: { payer_id: 'PP-unknown' },
      },
    };

    await handleSubscriptionSuspended('tenant-1', 'bot-token', event);
    expect(mockedSendMessage).not.toHaveBeenCalled();
    expect(mockedUpdateStatus).not.toHaveBeenCalled();
  });
});
