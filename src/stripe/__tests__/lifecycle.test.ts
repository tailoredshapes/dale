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

const TABLE = 'dale-test-table';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Subscription lifecycle: customer.subscription.deleted', () => {
  it('revokes user in DynamoDB AND removes them from the Telegram group', async () => {
    // Arrange: user has an active subscription linked to a room with a Telegram group
    mockedGetMapping.mockResolvedValue({
      pk: 'TENANT#tenant-1',
      sk: 'STRIPECUST#cus_abc',
      tenantId: 'tenant-1',
      stripeCustomerId: 'cus_abc',
      telegramUserId: 42,
      createdAt: '',
      GSI1pk: 'STRIPECUST#cus_abc',
      GSI1sk: 'TENANT#tenant-1',
    });

    mockedListUserRooms.mockResolvedValue([
      {
        pk: 'TENANT#tenant-1',
        sk: 'USERROOM#42#ROOM#room-1',
        tenantId: 'tenant-1',
        telegramUserId: 42,
        roomId: 'room-1',
        subscriptionStatus: 'active',
        stripeSubscriptionId: 'sub_xyz',
        createdAt: '',
        updatedAt: '',
        GSI1pk: 'TGUSER#42',
        GSI1sk: 'TENANT#tenant-1#ROOM#room-1',
      },
    ]);

    mockedGetRoom.mockResolvedValue({
      pk: 'TENANT#tenant-1',
      sk: 'ROOM#room-1',
      tenantId: 'tenant-1',
      roomId: 'room-1',
      name: 'Premium Club',
      telegramGroupId: -1001234567890,
      paymentLink: 'https://buy.stripe.com/test',
      isActive: true,
      createdAt: '',
      updatedAt: '',
    });

    mockedBanChatMember.mockResolvedValue(true);

    const subscription = {
      customer: 'cus_abc',
      id: 'sub_xyz',
    } as Stripe.Subscription;

    // Act
    await handleSubscriptionDeleted(TABLE, 'tenant-1', 'bot-token-123', subscription);

    // Assert: DynamoDB status is revoked to 'cancelled'
    expect(mockedUpdateStatus).toHaveBeenCalledWith(
      TABLE, 'tenant-1', 42, 'room-1', 'cancelled',
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
      pk: 'TENANT#tenant-1',
      sk: 'STRIPECUST#cus_abc',
      tenantId: 'tenant-1',
      stripeCustomerId: 'cus_abc',
      telegramUserId: 42,
      createdAt: '',
      GSI1pk: 'STRIPECUST#cus_abc',
      GSI1sk: 'TENANT#tenant-1',
    });

    mockedListUserRooms.mockResolvedValue([
      {
        pk: 'TENANT#tenant-1',
        sk: 'USERROOM#42#ROOM#room-1',
        tenantId: 'tenant-1',
        telegramUserId: 42,
        roomId: 'room-1',
        subscriptionStatus: 'active',
        stripeSubscriptionId: 'sub_xyz',
        createdAt: '',
        updatedAt: '',
        GSI1pk: 'TGUSER#42',
        GSI1sk: 'TENANT#tenant-1#ROOM#room-1',
      },
      {
        pk: 'TENANT#tenant-1',
        sk: 'USERROOM#42#ROOM#room-2',
        tenantId: 'tenant-1',
        telegramUserId: 42,
        roomId: 'room-2',
        subscriptionStatus: 'active',
        stripeSubscriptionId: 'sub_xyz',
        createdAt: '',
        updatedAt: '',
        GSI1pk: 'TGUSER#42',
        GSI1sk: 'TENANT#tenant-1#ROOM#room-2',
      },
    ]);

    mockedGetRoom
      .mockResolvedValueOnce({
        pk: 'TENANT#tenant-1',
        sk: 'ROOM#room-1',
        tenantId: 'tenant-1',
        roomId: 'room-1',
        name: 'Room 1',
        telegramGroupId: -100111,
        paymentLink: '',
        isActive: true,
        createdAt: '',
        updatedAt: '',
      })
      .mockResolvedValueOnce({
        pk: 'TENANT#tenant-1',
        sk: 'ROOM#room-2',
        tenantId: 'tenant-1',
        roomId: 'room-2',
        name: 'Room 2',
        telegramGroupId: -100222,
        paymentLink: '',
        isActive: true,
        createdAt: '',
        updatedAt: '',
      });

    mockedBanChatMember.mockResolvedValue(true);

    const subscription = { customer: 'cus_abc', id: 'sub_xyz' } as Stripe.Subscription;
    await handleSubscriptionDeleted(TABLE, 'tenant-1', 'bot-token', subscription);

    // Both rooms should be revoked
    expect(mockedUpdateStatus).toHaveBeenCalledTimes(2);
    expect(mockedUpdateStatus).toHaveBeenCalledWith(TABLE, 'tenant-1', 42, 'room-1', 'cancelled');
    expect(mockedUpdateStatus).toHaveBeenCalledWith(TABLE, 'tenant-1', 42, 'room-2', 'cancelled');

    // Both groups should have the user banned
    expect(mockedBanChatMember).toHaveBeenCalledTimes(2);
    expect(mockedBanChatMember).toHaveBeenCalledWith('bot-token', -100111, 42);
    expect(mockedBanChatMember).toHaveBeenCalledWith('bot-token', -100222, 42);
  });

  it('skips Telegram removal when no customer mapping exists', async () => {
    mockedGetMapping.mockResolvedValue(null);

    const subscription = { customer: 'cus_unknown', id: 'sub_xyz' } as Stripe.Subscription;
    await handleSubscriptionDeleted(TABLE, 'tenant-1', 'bot-token', subscription);

    expect(mockedUpdateStatus).not.toHaveBeenCalled();
    expect(mockedBanChatMember).not.toHaveBeenCalled();
    expect(mockedSendMessage).not.toHaveBeenCalled();
  });
});
