import { describe, it, expect } from 'vitest';
import type { Room, UserRoom } from '../../shared/types.js';
import {
  handleStartDM,
  handleStartGroup,
  handleStatus,
  handleHelp,
  handleUnknownCommand,
} from '../commands.js';

const makeRoom = (overrides: Partial<Room> = {}): Room => ({
  id: 'r1',
  tenant_id: 't1',
  name: 'VIP Room',
  payment_link: 'https://buy.stripe.com/test',
  active: true,
  ...overrides,
});

const makeUserRoom = (overrides: Partial<UserRoom> = {}): UserRoom => ({
  id: 'ur1',
  tenant_id: 't1',
  telegram_user_id: 123,
  room_id: 'r1',
  subscription_status: 'active',
  ...overrides,
});

describe('handleStartDM', () => {
  it('shows no rooms message when no rooms exist', () => {
    const result = handleStartDM([], [], 't1', 123);
    expect(result).toContain('no groups available');
  });

  it('shows subscribed rooms as active', () => {
    const rooms = [makeRoom()];
    const userRooms = [makeUserRoom()];
    const result = handleStartDM(rooms, userRooms, 't1', 123);
    expect(result).toContain('VIP Room');
    expect(result).toContain("You're in!");
  });

  it('shows unsubscribed rooms with Stripe payment link', () => {
    const rooms = [makeRoom()];
    const result = handleStartDM(rooms, [], 't1', 456);
    expect(result).toContain('VIP Room');
    expect(result).toContain('client_reference_id=t1:456:r1');
    expect(result).toContain('Pay with card');
  });

  it('shows unsubscribed rooms with PayPal link', () => {
    const rooms = [makeRoom({ paypal_payment_link: 'https://paypal.com/subscribe?plan_id=P-123' })];
    const result = handleStartDM(rooms, [], 't1', 456);
    expect(result).toContain('Pay with PayPal');
    expect(result).toContain('custom_id=t1:456:r1');
  });

  it('shows both links when both configured', () => {
    const rooms = [makeRoom({ paypal_payment_link: 'https://paypal.com/subscribe?plan_id=P-123' })];
    const result = handleStartDM(rooms, [], 't1', 456);
    expect(result).toContain('Pay with card');
    expect(result).toContain('Pay with PayPal');
  });

  it('skips inactive rooms', () => {
    const rooms = [makeRoom({ active: false })];
    const result = handleStartDM(rooms, [], 't1', 123);
    expect(result).not.toContain('VIP Room');
  });
});

describe('handleStartGroup', () => {
  it('shows welcome back for active subscriber', () => {
    const result = handleStartGroup(makeRoom(), makeUserRoom(), 't1', 123);
    expect(result).toContain('Welcome back');
    expect(result).toContain('VIP Room');
  });

  it('shows Stripe payment link for non-subscriber', () => {
    const result = handleStartGroup(makeRoom(), null, 't1', 456);
    expect(result).toContain('Subscribe here');
    expect(result).toContain('client_reference_id=t1:456:r1');
    expect(result).toContain('Pay with card');
  });

  it('shows both links for non-subscriber when both configured', () => {
    const result = handleStartGroup(makeRoom({ paypal_payment_link: 'https://paypal.com/subscribe?plan_id=P-123' }), null, 't1', 456);
    expect(result).toContain('Pay with card');
    expect(result).toContain('Pay with PayPal');
    expect(result).toContain('custom_id=t1:456:r1');
  });
});

describe('handleStatus', () => {
  it('shows no subscriptions message', () => {
    const result = handleStatus([], []);
    expect(result).toContain('do not have any subscriptions');
  });

  it('lists subscriptions with status', () => {
    const rooms = [makeRoom()];
    const userRooms = [makeUserRoom()];
    const result = handleStatus(userRooms, rooms);
    expect(result).toContain('VIP Room');
    expect(result).toContain('active');
  });
});

describe('handleHelp', () => {
  it('lists available commands', () => {
    const result = handleHelp();
    expect(result).toContain('/start');
    expect(result).toContain('/status');
    expect(result).toContain('/help');
  });
});

describe('handleUnknownCommand', () => {
  it('suggests /help', () => {
    expect(handleUnknownCommand()).toContain('/help');
  });
});
