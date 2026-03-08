import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/users.js', () => ({
  listRoomSubscribers: vi.fn(),
}));

import { handleListSubscribers } from '../routes/subscribers.js';
import { listRoomSubscribers } from '../../db/users.js';

const mockedListSubscribers = vi.mocked(listRoomSubscribers);

const AUTH = { cognitoSub: 'sub-123', tenantId: 'tenant-1' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('handleListSubscribers', () => {
  it('returns subscribers list', async () => {
    mockedListSubscribers.mockResolvedValue([
      {
        id: 'ur-1',
        tenant_id: 'tenant-1',
        telegram_user_id: 123,
        room_id: 'r1',
        subscription_status: 'active',
      },
    ]);

    const result = await handleListSubscribers(AUTH, 'r1');
    expect(result.statusCode).toBe(200);
    const subs = JSON.parse(result.body);
    expect(subs).toHaveLength(1);
    expect(subs[0].telegramUserId).toBe(123);
  });
});
