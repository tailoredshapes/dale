import { Given, When, Then, Before } from 'quickpickle';
import { vi, expect } from 'vitest';
import type Stripe from 'stripe';
import type { DaleWorld } from '../world.js';

// --- Module mocks (hoisted by Vite before any imports are resolved) ---

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

// --- Imports of mocked modules (resolved after hoisting) ---

import {
  handleCheckoutCompleted,
  handleInvoicePaid,
  handleSubscriptionDeleted,
  handleSubscriptionUpdated,
} from '../../stripe/events.js';
import { getTenantByStripeCustomer, createUserRoomMapping } from '../../db/stripe-mappings.js';
import { updateUserRoomStatus, listUserRooms } from '../../db/users.js';
import { sendMessage, createChatInviteLink, banChatMember, unbanChatMember } from '../../telegram/api.js';
import { getRoom } from '../../db/rooms.js';

// --- Helpers ---

const BASE_TENANT = 'tenant-1';

function makeMapping(customerId: string, userId: number) {
  return {
    tenant_id: BASE_TENANT,
    telegram_user_id: userId,
  };
}

function makeUserRoom(userId: number, roomId: string, subId: string, status: string) {
  return {
    id: `ur_${userId}_${roomId}`,
    tenant_id: BASE_TENANT,
    room_id: roomId,
    telegram_user_id: userId,
    subscription_status: status as any,
    stripe_subscription_id: subId,
  };
}

function makeRoom(tenantId: string, roomId: string, name: string, telegramGroupId?: number) {
  return {
    id: roomId,
    tenant_id: tenantId,
    name,
    telegram_group_id: telegramGroupId ? String(telegramGroupId) : undefined,
    payment_link: 'https://buy.stripe.com/test',
    active: true,
  };
}

// --- Hooks ---

Before(async (state: any) => {
  vi.resetAllMocks();
  // Safe defaults so handlers don't blow up on unset mocks
  vi.mocked(listUserRooms).mockResolvedValue([]);
});

// --- Given: context setup ---

Given('table {string} tenant {string} bot {string}',
  (state: DaleWorld, tableName: string, tenantId: string, botToken: string) => {
    state.tableName = tableName;
    state.tenantId = tenantId;
    state.botToken = botToken;
  });

Given('a user mapping for customer {string} with user {int}',
  (_state: any, customerId: string, userId: number) => {
    vi.mocked(getTenantByStripeCustomer).mockResolvedValue(makeMapping(customerId, userId));
  });

Given('no mapping exists for customer {string}',
  (_state: any, _customerId: string) => {
    vi.mocked(getTenantByStripeCustomer).mockResolvedValue(null);
  });

Given('a room {string} named {string} with Telegram group {int}',
  (state: DaleWorld, roomId: string, name: string, groupId: number) => {
    vi.mocked(getRoom).mockResolvedValue(makeRoom(state.tenantId, roomId, name, groupId));
  });

Given('a room {string} named {string} without a Telegram group',
  (state: DaleWorld, roomId: string, name: string) => {
    vi.mocked(getRoom).mockResolvedValue(makeRoom(state.tenantId, roomId, name));
  });

Given('room {string} has Telegram group {int}',
  (state: DaleWorld, roomId: string, groupId: number) => {
    vi.mocked(getRoom).mockResolvedValue(makeRoom(state.tenantId, roomId, 'Room', groupId));
  });

Given('room {string} has no Telegram group',
  (state: DaleWorld, roomId: string) => {
    vi.mocked(getRoom).mockResolvedValue(makeRoom(state.tenantId, roomId, 'Room'));
  });

Given('user {int} has an active subscription {string} to room {string}',
  (_state: any, userId: number, subId: string, roomId: string) => {
    vi.mocked(listUserRooms).mockResolvedValue([makeUserRoom(userId, roomId, subId, 'active')]);
  });

Given('user {int} has a cancelled subscription {string} to room {string}',
  (_state: any, userId: number, subId: string, roomId: string) => {
    vi.mocked(listUserRooms).mockResolvedValue([makeUserRoom(userId, roomId, subId, 'cancelled')]);
  });

Given('user {int} has a past_due subscription {string} to room {string}',
  (_state: any, userId: number, subId: string, roomId: string) => {
    vi.mocked(listUserRooms).mockResolvedValue([makeUserRoom(userId, roomId, subId, 'past_due')]);
  });

Given('user {int} has no rooms matching subscription {string}',
  (_state: any, _userId: number, _subId: string) => {
    vi.mocked(listUserRooms).mockResolvedValue([]);
  });

Given('a checkout session for user {int} paying for room {string} with subscription {string}',
  (state: DaleWorld, userId: number, roomId: string, subId: string) => {
    state.session = {
      client_reference_id: `${state.tenantId}:${userId}:${roomId}`,
      customer: 'cus_abc',
      subscription: subId,
    };
  });

Given('a checkout session with invalid client_reference_id {string}',
  (state: DaleWorld, refId: string) => {
    state.session = {
      client_reference_id: refId,
      customer: 'cus_abc',
      subscription: 'sub_xyz',
    };
  });

Given('a checkout session for user {int} from tenant {string} paying for room {string}',
  (state: DaleWorld, userId: number, tenantId: string, roomId: string) => {
    state.session = {
      client_reference_id: `${tenantId}:${userId}:${roomId}`,
      customer: 'cus_abc',
      subscription: 'sub_xyz',
    };
  });

Given('the invite link creation succeeds with {string}',
  (_state: any, link: string) => {
    vi.mocked(createChatInviteLink).mockResolvedValue(link);
  });

Given('the invite link creation fails',
  (_state: any) => {
    vi.mocked(createChatInviteLink).mockResolvedValue(null);
  });

// --- When: actions ---

When('the checkout is completed', async (state: DaleWorld) => {
  await handleCheckoutCompleted(
    state.tenantId,
    state.botToken,
    state.session as Stripe.Checkout.Session,
  );
});

When('subscription {string} is deleted for customer {string}',
  async (state: DaleWorld, subId: string, customerId: string) => {
    state.subscription = { customer: customerId, id: subId, status: 'canceled' as any };
    await handleSubscriptionDeleted(
      state.tenantId,
      state.botToken,
      state.subscription as Stripe.Subscription,
    );
  });

When('invoice is paid for customer {string} subscription {string}',
  async (state: DaleWorld, customerId: string, subId: string) => {
    state.invoice = { customer: customerId, subscription: subId };
    await handleInvoicePaid(
      state.tenantId,
      state.botToken,
      state.invoice as Stripe.Invoice,
    );
  });

When('subscription {string} status changes to {string} for customer {string}',
  async (state: DaleWorld, subId: string, status: string, customerId: string) => {
    state.subscription = { customer: customerId, id: subId, status: status as any };
    await handleSubscriptionUpdated(
      state.tenantId,
      state.botToken,
      state.subscription as Stripe.Subscription,
    );
  });

// --- Then: assertions ---

Then('a single-use invite link is created for group {int}',
  (state: DaleWorld, groupId: number) => {
    expect(vi.mocked(createChatInviteLink)).toHaveBeenCalledWith(state.botToken, groupId);
  });

Then('no invite link is created', (_state: any) => {
  expect(vi.mocked(createChatInviteLink)).not.toHaveBeenCalled();
});

Then('the user receives a message containing {string}',
  (state: DaleWorld, text: string) => {
    expect(vi.mocked(sendMessage)).toHaveBeenCalledWith(
      state.botToken,
      expect.any(Number),
      expect.stringContaining(text),
    );
  });

Then('the message does not contain a Telegram link', (_state: any) => {
  const calls = vi.mocked(sendMessage).mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  const lastMessage = calls[calls.length - 1][2];
  expect(lastMessage).not.toContain('t.me');
});

Then('no message is sent', (_state: any) => {
  expect(vi.mocked(sendMessage)).not.toHaveBeenCalled();
});

Then('no mapping is created', (_state: any) => {
  expect(vi.mocked(createUserRoomMapping)).not.toHaveBeenCalled();
});

Then("the user's subscription status is updated to {string}",
  (state: DaleWorld, status: string) => {
    expect(vi.mocked(updateUserRoomStatus)).toHaveBeenCalledWith(
      state.tenantId,
      expect.any(Number),
      expect.any(String),
      status,
    );
  });

Then('no status is updated', (_state: any) => {
  expect(vi.mocked(updateUserRoomStatus)).not.toHaveBeenCalled();
});

Then('the user is banned from group {int}',
  (state: DaleWorld, groupId: number) => {
    expect(vi.mocked(banChatMember)).toHaveBeenCalledWith(
      state.botToken,
      groupId,
      expect.any(Number),
    );
  });

Then('no ban is issued', (_state: any) => {
  expect(vi.mocked(banChatMember)).not.toHaveBeenCalled();
});

Then('the user is unbanned from group {int}',
  (state: DaleWorld, groupId: number) => {
    expect(vi.mocked(unbanChatMember)).toHaveBeenCalledWith(
      state.botToken,
      groupId,
      expect.any(Number),
    );
  });

Then('no unban is issued', (_state: any) => {
  expect(vi.mocked(unbanChatMember)).not.toHaveBeenCalled();
});

Then('the user receives a cancellation message', (state: DaleWorld) => {
  expect(vi.mocked(sendMessage)).toHaveBeenCalledWith(
    state.botToken,
    expect.any(Number),
    expect.stringContaining('cancelled'),
  );
});
