import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/rooms.js', () => ({
  // createRoom returns the room with a meshql-rs generated ID
  createRoom: vi.fn().mockResolvedValue({ id: 'meshql-room-uuid' }),
}));

import { handleMyChatMember } from '../group-handler.js';
import { createRoom } from '../../db/rooms.js';
import type { TelegramChatMemberUpdated } from '../../shared/types.js';

const mockedCreateRoom = vi.mocked(createRoom);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('handleMyChatMember', () => {
  const ctx = { tenantId: 'tenant-1', botUserId: 123 };

  it('creates room when bot is added as member', async () => {
    const update: TelegramChatMemberUpdated = {
      chat: { id: -100999, type: 'supergroup', title: 'My Group' },
      from: { id: 456, is_bot: false, first_name: 'Admin' },
      date: 1234567890,
      old_chat_member: { user: { id: 123, is_bot: true, first_name: 'Bot' }, status: 'left' },
      new_chat_member: { user: { id: 123, is_bot: true, first_name: 'Bot' }, status: 'member' },
    };

    await handleMyChatMember(ctx, update);

    // No id field - let meshql-rs restlette generate it
    expect(mockedCreateRoom).toHaveBeenCalledWith({
      tenant_id: 'tenant-1',
      name: 'My Group',
      telegram_group_id: '-100999',
      payment_link: '',
      active: false,
    });
  });

  it('creates room when bot is made administrator', async () => {
    const update: TelegramChatMemberUpdated = {
      chat: { id: -100999, type: 'supergroup', title: 'My Group' },
      from: { id: 456, is_bot: false, first_name: 'Admin' },
      date: 1234567890,
      old_chat_member: { user: { id: 123, is_bot: true, first_name: 'Bot' }, status: 'left' },
      new_chat_member: { user: { id: 123, is_bot: true, first_name: 'Bot' }, status: 'administrator' },
    };

    await handleMyChatMember(ctx, update);
    expect(mockedCreateRoom).toHaveBeenCalled();
  });

  it('does not create room when bot is removed', async () => {
    const update: TelegramChatMemberUpdated = {
      chat: { id: -100999, type: 'supergroup', title: 'My Group' },
      from: { id: 456, is_bot: false, first_name: 'Admin' },
      date: 1234567890,
      old_chat_member: { user: { id: 123, is_bot: true, first_name: 'Bot' }, status: 'member' },
      new_chat_member: { user: { id: 123, is_bot: true, first_name: 'Bot' }, status: 'left' },
    };

    await handleMyChatMember(ctx, update);
    expect(mockedCreateRoom).not.toHaveBeenCalled();
  });

  it('ignores events for other users', async () => {
    const update: TelegramChatMemberUpdated = {
      chat: { id: -100999, type: 'supergroup', title: 'My Group' },
      from: { id: 456, is_bot: false, first_name: 'Admin' },
      date: 1234567890,
      old_chat_member: { user: { id: 789, is_bot: false, first_name: 'Other' }, status: 'left' },
      new_chat_member: { user: { id: 789, is_bot: false, first_name: 'Other' }, status: 'member' },
    };

    await handleMyChatMember(ctx, update);
    expect(mockedCreateRoom).not.toHaveBeenCalled();
  });
});
