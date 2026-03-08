interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; is_bot: boolean; first_name: string };
    chat: { id: number; type: string; title?: string };
    date: number;
    text?: string;
  };
  my_chat_member?: {
    chat: { id: number; type: string; title?: string };
    from: { id: number; is_bot: boolean; first_name: string };
    date: number;
    old_chat_member: { user: { id: number; is_bot: boolean; first_name: string }; status: string };
    new_chat_member: { user: { id: number; is_bot: boolean; first_name: string }; status: string };
  };
}

let updateIdCounter = 100000;

export function buildBotAddedToGroup(opts: {
  groupId: number;
  groupTitle: string;
}): TelegramUpdate {
  // Bot user ID matches the fake token '000000000:fake-bot-token-for-e2e'
  const botUserId = 0;

  return {
    update_id: updateIdCounter++,
    my_chat_member: {
      chat: {
        id: opts.groupId,
        type: 'supergroup',
        title: opts.groupTitle,
      },
      from: {
        id: 999999,
        is_bot: false,
        first_name: 'GroupAdmin',
      },
      date: Math.floor(Date.now() / 1000),
      old_chat_member: {
        user: { id: botUserId, is_bot: true, first_name: 'TestBot' },
        status: 'left',
      },
      new_chat_member: {
        user: { id: botUserId, is_bot: true, first_name: 'TestBot' },
        status: 'member',
      },
    },
  };
}

export function buildMessage(opts: {
  chatId: number;
  chatType: string;
  text: string;
  userId?: number;
  firstName?: string;
}): TelegramUpdate {
  return {
    update_id: updateIdCounter++,
    message: {
      message_id: updateIdCounter++,
      from: {
        id: opts.userId ?? 111111,
        is_bot: false,
        first_name: opts.firstName ?? 'TestUser',
      },
      chat: {
        id: opts.chatId,
        type: opts.chatType,
      },
      date: Math.floor(Date.now() / 1000),
      text: opts.text,
    },
  };
}

export async function sendTelegramWebhook(
  url: string,
  secret: string,
  payload: TelegramUpdate,
  tenantId?: string,
): Promise<{ status: number; body: string }> {
  // Include tenant parameter in URL (consistent with Stripe/PayPal webhooks)
  const webhookUrl = tenantId ? `${url}?tenant=${tenantId}` : url;

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-telegram-bot-api-secret-token': secret,
    },
    body: JSON.stringify(payload),
  });

  return {
    status: response.status,
    body: await response.text(),
  };
}
