import type { Room, UserRoom } from '../shared/types.js';

export function handleStartDM(
  rooms: Room[],
  userRooms: UserRoom[],
  tenantId: string,
  telegramUserId: number,
): string {
  if (rooms.length === 0) {
    return 'This bot has no groups available yet. Check back later!';
  }

  const activeRoomIds = new Set(
    userRooms
      .filter((ur) => ur.subscription_status === 'active')
      .map((ur) => ur.room_id),
  );

  const lines = ["Hey! \u{1F44B} Here's what you can join:\n"];
  for (const room of rooms) {
    if (!room.active) continue;
    if (activeRoomIds.has(room.id)) {
      lines.push(`\u2705 *${room.name}* \u2014 You're in!`);
    } else {
      const ref = `${tenantId}:${telegramUserId}:${room.id}`;
      const desc = room.price_description ? ` (${room.price_description})` : '';
      const links: string[] = [];
      if (room.payment_link) {
        links.push(`[Pay with card](${room.payment_link}?client_reference_id=${ref})`);
      }
      if (room.paypal_payment_link) {
        links.push(`[Pay with PayPal](${room.paypal_payment_link}&custom_id=${ref})`);
      }
      lines.push(`\u{1F512} *${room.name}*${desc}\n${links.join(' \u00B7 ')}`);
    }
  }
  return lines.join('\n');
}

export function handleStartGroup(
  room: Room,
  userRoom: UserRoom | null,
  tenantId: string,
  telegramUserId: number,
): string {
  if (userRoom && userRoom.subscription_status === 'active') {
    return `Welcome back to *${room.name}*! Your subscription is active.`;
  }
  const ref = `${tenantId}:${telegramUserId}:${room.id}`;
  const links: string[] = [];
  if (room.payment_link) {
    links.push(`[Pay with card](${room.payment_link}?client_reference_id=${ref})`);
  }
  if (room.paypal_payment_link) {
    links.push(`[Pay with PayPal](${room.paypal_payment_link}&custom_id=${ref})`);
  }
  return `Welcome to *${room.name}*! Subscribe here to get access:\n${links.join(' \u00B7 ')}`;
}

export function handleStatus(userRooms: UserRoom[], rooms: Room[]): string {
  if (userRooms.length === 0) {
    return 'You do not have any subscriptions yet. Use /start to see available groups.';
  }

  const roomMap = new Map(rooms.map((r) => [r.id, r]));
  const lines = ['*Your subscriptions:*\n'];
  for (const ur of userRooms) {
    const room = roomMap.get(ur.room_id);
    const name = room?.name ?? ur.room_id;
    const statusLabel: Record<string, string> = {
      active: '\u2705 active',
      past_due: '\u26A0\uFE0F past due',
      cancelled: '\u274C cancelled',
      none: '\u2014 none',
    };
    lines.push(`${name}: ${statusLabel[ur.subscription_status] ?? ur.subscription_status}`);
  }
  return lines.join('\n');
}

export function handleHelp(): string {
  return [
    '*Available commands:*',
    '/start - See available groups and subscribe',
    '/status - Check your subscription status',
    '/help - Show this help message',
  ].join('\n');
}

export function handleUnknownCommand(): string {
  return "I don't recognize that command. Use /help to see available commands.";
}
