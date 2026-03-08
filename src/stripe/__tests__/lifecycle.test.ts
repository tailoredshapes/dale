import { describe, it, expect, vi, beforeEach } from 'vitest';
import type Stripe from 'stripe';

vi.mock('../../db/stripe-mappings.js', () => ({
  getTenantByStripeCustomer: vi.fn(),
  createUserRoomMapping: vi.fn(),
}));

vi.mock('../../db/users.js', () => ({
  updateUserRoomStatus: vi.fn(),
  listUserRooms: vi.fn(),
}));

vi.mock('../../telegram/api.js', () => ({
  sendMessage: vi.fn(),
  createChatInviteLink: vi.fn(),
  banChatMember: vi.fn(),
  unbanChatMember: vi.fn(),
}));

vi.mock('../../db/rooms.js', () => ({
  getRoom: vi.fn(),
}));

import { handleSubscriptionDeleted } from '../events.js';
import { getTenantByStripeCustomer } from '../../db/stripe-mappings.js';
import { updateUserRoomStatus, listUserRooms } from '../../db/users.js';
import { sendMessage, banChatMember } from '../../telegram/api.js';
import { getRoom } from '../../db/rooms.js';

const mockedGetMapping = vi.mocked(getTenantByStripeCustomer);
const mockedListUserRooms = vi.mocked(listUserRooms);
const mockedUpdateStatus = vi.mocked(updateUserRoomStatus);
const mockedGetRoom = vi.mocked(getRoom);
const mockedBanChatMember = vi.mocked(banChatMember);
const mockedSendMessage = vi.mocked(sendMessage);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Subscription lifecycle: customer.subscription.deleted', () => {
  it('revokes user in DynamoDB AND removes them from the Telegram group', async () => {
    // Arrange: user has an active subscription linked to a room with a Telegram group
    mockedGetMapping.mockResolvedValue({
      tenant_id: 'tenant-1',
      telegram_user_id: 42,
    });

    mockedListUserRooms.mockResolvedValue([
      {
        id: 'ur-1',
        tenant_id: 'tenant-1',
        telegram_user_id: 42,
        room_id: 'room-1',
        subscription_status: 'active',
        stripe_subscription_id: 'sub_xyz',
      },
    ]);

    mockedGetRoom.mockResolvedValue({
      id: 'room-1',
      tenant_id: 'tenant-1',
      name: 'Premium Club',
      telegram_group_id: '-1001234567890',
      payment_link: 'https://buy.stripe.com/test',
      active: true,
    });

    mockedBanChatMember.mockResolvedValue(true);

    const subscription = {
      customer: 'cus_abc',
      id: 'sub_xyz',
    } as Stripe.Subscription;

    // Act
    await handleSubscriptionDeleted('tenant-1', 'bot-token-123', subscription);

    // Assert: DynamoDB status is revoked to 'cancelled'
    expect(mockedUpdateStatus).toHaveBeenCalledWith(
      'tenant-1', 42, 'room-1', 'cancelled',
    );

    // Assert: Telegram API is called to ban (remove) user from the group
    expect(mockedBanChatMember).toHaveBeenCalledWith(
      'bot-token-123', -1001234567890, 42,
    );

    // Assert: user receives a cancellation notification
    expect(mockedSendMessage).toHaveBeenCalledWith(
      'bot-token-123',
      42,
      expect.stringContaining('cancelled'),
    );
  });

  it('revokes across multiple rooms when user has several subscriptions', async () => {
    mockedGetMapping.mockResolvedValue({
      tenant_id: 'tenant-1',
      telegram_user_id: 42,
    });

    mockedListUserRooms.mockResolvedValue([
      {
        id: 'ur-1',
        tenant_id: 'tenant-1',
        telegram_user_id: 42,
        room_id: 'room-1',
        subscription_status: 'active',
        stripe_subscription_id: 'sub_xyz',
      },
      {
        id: 'ur-2',
        tenant_id: 'tenant-1',
        telegram_user_id: 42,
        room_id: 'room-2',
        subscription_status: 'active',
        stripe_subscription_id: 'sub_xyz',
      },
    ]);

    mockedGetRoom
      .mockResolvedValueOnce({
        id: 'room-1',
        tenant_id: 'tenant-1',
        name: 'Room 1',
        telegram_group_id: '-100111',
        payment_link: '',
        active: true,
      })
      .mockResolvedValueOnce({
        id: 'room-2',
        tenant_id: 'tenant-1',
        name: 'Room 2',
        telegram_group_id: '-100222',
        payment_link: '',
        active: true,
      });

    mockedBanChatMember.mockResolvedValue(true);

    const subscription = { customer: 'cus_abc', id: 'sub_xyz' } as Stripe.Subscription;
    await handleSubscriptionDeleted('tenant-1', 'bot-token', subscription);

    // Both rooms should be revoked
    expect(mockedUpdateStatus).toHaveBeenCalledTimes(2);
    expect(mockedUpdateStatus).toHaveBeenCalledWith('tenant-1', 42, 'room-1', 'cancelled');
    expect(mockedUpdateStatus).toHaveBeenCalledWith('tenant-1', 42, 'room-2', 'cancelled');

    // Both groups should have the user banned
    expect(mockedBanChatMember).toHaveBeenCalledTimes(2);
    expect(mockedBanChatMember).toHaveBeenCalledWith('bot-token', -100111, 42);
    expect(mockedBanChatMember).toHaveBeenCalledWith('bot-token', -100222, 42);
  });

  it('skips Telegram removal when no customer mapping exists', async () => {
    mockedGetMapping.mockResolvedValue(null);

    const subscription = { customer: 'cus_unknown', id: 'sub_xyz' } as Stripe.Subscription;
    await handleSubscriptionDeleted('tenant-1', 'bot-token', subscription);

    expect(mockedUpdateStatus).not.toHaveBeenCalled();
    expect(mockedBanChatMember).not.toHaveBeenCalled();
    expect(mockedSendMessage).not.toHaveBeenCalled();
  });
});
