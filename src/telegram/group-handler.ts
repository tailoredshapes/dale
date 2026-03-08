import type { TelegramChatMemberUpdated } from '../shared/types.js';
import { createRoom } from '../db/rooms.js';

export interface GroupHandlerContext {
  tenantId: string;
  botUserId: number;
}

export async function handleMyChatMember(
  ctx: GroupHandlerContext,
  update: TelegramChatMemberUpdated,
): Promise<void> {
  // Only handle events for this bot
  if (update.new_chat_member.user.id !== ctx.botUserId) return;

  const newStatus = update.new_chat_member.status;
  const chatId = update.chat.id;
  const chatTitle = update.chat.title ?? `Group ${chatId}`;

  if (newStatus === 'member' || newStatus === 'administrator') {
    // Bot was added to a group — auto-create a room record
    console.log(`Bot added to group ${chatId} (${chatTitle}) for tenant ${ctx.tenantId}`);
    try {
      // Let meshql-rs restlette generate the ID
      await createRoom({
        tenant_id: ctx.tenantId,
        name: chatTitle,
        telegram_group_id: String(chatId),
        payment_link: '',
        active: false, // Tenant must configure payment link before activating
      });
    } catch (err) {
      console.error(`Failed to create room for group ${chatId}:`, err);
    }
  } else if (newStatus === 'left' || newStatus === 'kicked') {
    console.log(`Bot removed from group ${chatId} for tenant ${ctx.tenantId}`);
  }
}
