import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getTenantSecrets } from '../shared/tenant-config.js';
import { getUserRoom, listUserRooms } from '../db/users.js';
import { listRoomsForTenant, getRoomByTelegramGroupId } from '../db/rooms.js';
import { sendMessage } from './api.js';
import { validateTelegramSecret, parseTelegramUpdate, isGroupChat } from './middleware.js';
import { handleStartDM, handleStartGroup, handleStatus, handleHelp, handleUnknownCommand } from './commands.js';
import { handleMyChatMember } from './group-handler.js';

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    // Step 1: Extract tenant from query string (consistent with Stripe/PayPal webhooks)
    const tenantId = event.queryStringParameters?.tenant;
    if (!tenantId) {
      return { statusCode: 400, body: 'Missing tenant parameter' };
    }

    // Step 2: Extract webhook secret from header
    const secret = event.headers['x-telegram-bot-api-secret-token'];
    if (!secret) {
      return { statusCode: 401, body: 'Missing webhook secret' };
    }

    // Step 3: Load tenant secrets
    let tenantSecrets;
    try {
      tenantSecrets = await getTenantSecrets(tenantId);
    } catch (err) {
      // Return 401 for security - don't reveal whether tenant exists
      console.error(`Failed to load secrets for tenant ${tenantId}:`, err);
      return { statusCode: 401, body: 'Invalid tenant or configuration' };
    }

    // Step 4: Validate the webhook secret matches the specified tenant's secret
    if (!validateTelegramSecret(secret, tenantSecrets.telegramWebhookSecret)) {
      console.warn('Webhook secret mismatch for tenant', tenantId);
      return { statusCode: 401, body: 'Invalid webhook secret' };
    }

    // Step 5: Parse the update
    const update = parseTelegramUpdate(event.body ?? '');
    if (!update) {
      return { statusCode: 200, body: 'ok' };
    }

    // Step 6: Handle my_chat_member events (bot added/removed from groups)
    if (update.my_chat_member) {
      // Extract bot user ID from the token (first part before ':')
      const botUserId = parseInt(tenantSecrets.telegramBotToken.split(':')[0], 10);
      await handleMyChatMember(
        { tenantId, botUserId },
        update.my_chat_member,
      );
      return { statusCode: 200, body: 'ok' };
    }

    // Step 7: Handle messages
    if (!update.message?.text || !update.message.from) {
      return { statusCode: 200, body: 'ok' };
    }

    const { message } = update;
    const chatId = message.chat.id;
    const telegramUserId = message.from!.id;
    const text = message.text!.trim();
    const command = text.split(' ')[0].split('@')[0].toLowerCase();
    const inGroup = isGroupChat(message.chat.type);

    let response: string;

    if (command === '/start') {
      if (inGroup) {
        // In a group: show this room's payment link
        const room = await getRoomByTelegramGroupId(chatId);
        if (!room) {
          response = 'This group is not linked to a room yet.';
        } else {
          const userRoom = await getUserRoom(tenantId, telegramUserId, room.id);
          response = handleStartGroup(room, userRoom, tenantId, telegramUserId);
        }
      } else {
        // In DM: show all rooms
        const rooms = await listRoomsForTenant(tenantId);
        const userRooms = await listUserRooms(tenantId, telegramUserId);
        response = handleStartDM(rooms, userRooms, tenantId, telegramUserId);
      }
    } else if (command === '/status') {
      const rooms = await listRoomsForTenant(tenantId);
      const userRooms = await listUserRooms(tenantId, telegramUserId);
      response = handleStatus(userRooms, rooms);
    } else if (command === '/help') {
      response = handleHelp();
    } else if (command.startsWith('/')) {
      response = handleUnknownCommand();
    } else if (!inGroup) {
      response = "I work with commands! Try /start to see available groups, or /help for a list of commands.";
    } else {
      return { statusCode: 200, body: 'ok' };
    }

    await sendMessage(tenantSecrets.telegramBotToken, chatId, response);
  } catch (error) {
    console.error('Telegram webhook error:', error);
  }

  return { statusCode: 200, body: 'ok' };
}
