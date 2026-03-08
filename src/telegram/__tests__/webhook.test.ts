import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

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
import { getTenantSecrets } from '../../shared/tenant-config.js';
import { listUserRooms } from '../../db/users.js';
import { listRoomsForTenant } from '../../db/rooms.js';
import { sendMessage } from '../api.js';

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

function makeEvent(
  text: string,
  secret = 'test-webhook-secret',
  chatType = 'private',
  tenant = 'tenant-1',
): APIGatewayProxyEventV2 {
  return {
    headers: { 'x-telegram-bot-api-secret-token': secret },
    queryStringParameters: { tenant },
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
  mockedGetSecrets.mockResolvedValue(TENANT_SECRETS);
  mockedListRooms.mockResolvedValue([]);
  mockedListUserRooms.mockResolvedValue([]);
});

describe('Telegram webhook handler', () => {
  it('returns 200 on valid request', async () => {
    const result = await handler(makeEvent('/start'));
    expect(result.statusCode).toBe(200);
  });

  it('returns 400 when tenant parameter is missing', async () => {
    const event = {
      headers: { 'x-telegram-bot-api-secret-token': 'test-webhook-secret' },
      queryStringParameters: undefined,
      body: JSON.stringify({ update_id: 1, message: {} }),
    } as unknown as APIGatewayProxyEventV2;
    const result = await handler(event);
    expect(result.statusCode).toBe(400);
    expect(result.body).toContain('tenant');
  });

  it('returns 401 when secret is missing', async () => {
    const event = {
      headers: {},
      queryStringParameters: { tenant: 'tenant-1' },
      body: JSON.stringify({ update_id: 1, message: {} }),
    } as unknown as APIGatewayProxyEventV2;
    const result = await handler(event);
    expect(result.statusCode).toBe(401);
    expect(mockedSendMessage).not.toHaveBeenCalled();
  });

  it('returns 401 when webhook secret does not match tenant', async () => {
    const result = await handler(makeEvent('/start', 'wrong-secret'));
    expect(result.statusCode).toBe(401);
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

  describe('multi-tenant isolation', () => {
    it('returns 401 when secret does not match the specified tenant', async () => {
      // Tenant B has a different webhook secret
      const tenantBSecrets = {
        ...TENANT_SECRETS,
        telegramWebhookSecret: 'tenant-b-secret',
      };
      mockedGetSecrets.mockResolvedValue(tenantBSecrets);

      // Send Tenant A's secret to Tenant B's endpoint
      const result = await handler(makeEvent('/start', 'tenant-a-secret', 'private', 'tenant-b'));
      expect(result.statusCode).toBe(401);
      expect(mockedSendMessage).not.toHaveBeenCalled();
    });

    it('processes request when secret matches the specified tenant', async () => {
      mockedGetSecrets.mockResolvedValue(TENANT_SECRETS);

      // Send matching secret
      const result = await handler(makeEvent('/start', 'test-webhook-secret', 'private', 'tenant-1'));
      expect(result.statusCode).toBe(200);
      expect(mockedSendMessage).toHaveBeenCalled();
    });
  });
});
