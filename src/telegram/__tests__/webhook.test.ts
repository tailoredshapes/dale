import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

vi.mock('../../shared/tenant-lookup.js', () => ({
  getTenantIdByWebhookSecret: vi.fn(),
}));

vi.mock('../../shared/tenant-config.js', () => ({
  getTenantSecrets: vi.fn(),
}));

vi.mock('../../db/users.js', () => ({
  getUserRoom: vi.fn(),
  listUserRooms: vi.fn(),
}));

vi.mock('../../db/rooms.js', () => ({
  listRoomsForTenant: vi.fn(),
  getRoomByTelegramGroupId: vi.fn(),
}));

vi.mock('../api.js', () => ({
  sendMessage: vi.fn(),
}));

vi.mock('../group-handler.js', () => ({
  handleMyChatMember: vi.fn(),
}));

import { handler } from '../webhook.js';
import { getTenantIdByWebhookSecret } from '../../shared/tenant-lookup.js';
import { getTenantSecrets } from '../../shared/tenant-config.js';
import { listUserRooms } from '../../db/users.js';
import { listRoomsForTenant } from '../../db/rooms.js';
import { sendMessage } from '../api.js';

const mockedGetTenantId = vi.mocked(getTenantIdByWebhookSecret);
const mockedGetSecrets = vi.mocked(getTenantSecrets);
const mockedListUserRooms = vi.mocked(listUserRooms);
const mockedListRooms = vi.mocked(listRoomsForTenant);
const mockedSendMessage = vi.mocked(sendMessage);

const TENANT_SECRETS = {
  telegramBotToken: '123:ABC',
  telegramWebhookSecret: 'test-webhook-secret',
  stripeSecretKey: 'sk_test_xxx',
  stripeWebhookSecret: 'whsec_xxx',
};

function makeEvent(text: string, secret = 'test-webhook-secret', chatType = 'private'): APIGatewayProxyEventV2 {
  return {
    headers: { 'x-telegram-bot-api-secret-token': secret },
    body: JSON.stringify({
      update_id: 1,
      message: {
        message_id: 1,
        from: { id: 123, is_bot: false, first_name: 'Test' },
        chat: { id: chatType === 'private' ? 123 : -100999, type: chatType },
        date: 1234567890,
        text,
      },
    }),
  } as unknown as APIGatewayProxyEventV2;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetTenantId.mockResolvedValue('tenant-1');
  mockedGetSecrets.mockResolvedValue(TENANT_SECRETS);
  mockedListRooms.mockResolvedValue([]);
  mockedListUserRooms.mockResolvedValue([]);
});

describe('Telegram webhook handler', () => {
  it('always returns 200', async () => {
    const result = await handler(makeEvent('/start'));
    expect(result.statusCode).toBe(200);
  });

  it('rejects missing secret silently', async () => {
    const event = {
      headers: {},
      body: JSON.stringify({ update_id: 1, message: {} }),
    } as unknown as APIGatewayProxyEventV2;
    const result = await handler(event);
    expect(result.statusCode).toBe(200);
    expect(mockedSendMessage).not.toHaveBeenCalled();
  });

  it('rejects unknown webhook secret', async () => {
    mockedGetTenantId.mockResolvedValue(null);
    const result = await handler(makeEvent('/start', 'unknown'));
    expect(result.statusCode).toBe(200);
    expect(mockedSendMessage).not.toHaveBeenCalled();
  });

  it('handles /start in DM with no rooms', async () => {
    await handler(makeEvent('/start'));
    expect(mockedSendMessage).toHaveBeenCalledWith(
      '123:ABC',
      123,
      expect.stringContaining('no groups available'),
    );
  });

  it('handles /start in DM with rooms', async () => {
    mockedListRooms.mockResolvedValue([{
      id: 'r1',
      tenant_id: 'tenant-1',
      name: 'VIP',
      payment_link: 'https://buy.stripe.com/test',
      active: true,
    }]);

    await handler(makeEvent('/start'));
    expect(mockedSendMessage).toHaveBeenCalledWith(
      '123:ABC',
      123,
      expect.stringContaining('client_reference_id=tenant-1:123:r1'),
    );
  });

  it('handles /status', async () => {
    await handler(makeEvent('/status'));
    expect(mockedSendMessage).toHaveBeenCalledWith(
      '123:ABC',
      123,
      expect.stringContaining('do not have any subscriptions'),
    );
  });

  it('handles /help', async () => {
    await handler(makeEvent('/help'));
    expect(mockedSendMessage).toHaveBeenCalledWith(
      '123:ABC',
      123,
      expect.stringContaining('/start'),
    );
  });

  it('handles unknown command', async () => {
    await handler(makeEvent('/unknown'));
    expect(mockedSendMessage).toHaveBeenCalledWith(
      '123:ABC',
      123,
      expect.stringContaining('/help'),
    );
  });

  it('responds to non-command text in DM', async () => {
    const result = await handler(makeEvent('hello'));
    expect(result.statusCode).toBe(200);
    expect(mockedSendMessage).toHaveBeenCalledWith(
      '123:ABC',
      123,
      expect.stringContaining('I work with commands'),
    );
  });
});
