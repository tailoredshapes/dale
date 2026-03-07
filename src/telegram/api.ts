function telegramUrl(botToken: string, method: string): string {
  // Allow overriding base URL for local development/testing
  const baseUrl = process.env.TELEGRAM_API_BASE_URL ?? 'https://api.telegram.org';
  const testPrefix = process.env.TELEGRAM_TEST_MODE === 'true' ? '/test' : '';
  return `${baseUrl}/bot${botToken}${testPrefix}/${method}`;
}

export async function sendMessage(botToken: string, chatId: number, text: string): Promise<void> {
  const url = telegramUrl(botToken, 'sendMessage');

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`Telegram sendMessage failed: ${response.status} ${body}`);
  }
}

export async function createChatInviteLink(botToken: string, chatId: number): Promise<string | null> {
  const url = telegramUrl(botToken, 'createChatInviteLink');

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, member_limit: 1 }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`Telegram createChatInviteLink failed: ${response.status} ${body}`);
    return null;
  }

  const result = await response.json() as { ok: boolean; result?: { invite_link: string } };
  return result.result?.invite_link ?? null;
}

export async function banChatMember(botToken: string, chatId: number, userId: number): Promise<boolean> {
  const url = telegramUrl(botToken, 'banChatMember');

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, user_id: userId }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`Telegram banChatMember failed: ${response.status} ${body}`);
    return false;
  }

  const result = await response.json() as { ok: boolean };
  return result.ok;
}

export async function unbanChatMember(botToken: string, chatId: number, userId: number): Promise<boolean> {
  const url = telegramUrl(botToken, 'unbanChatMember');

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, user_id: userId, only_if_banned: true }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`Telegram unbanChatMember failed: ${response.status} ${body}`);
    return false;
  }

  const result = await response.json() as { ok: boolean };
  return result.ok;
}

export async function setWebhook(
  botToken: string,
  webhookUrl: string,
  secretToken: string,
): Promise<boolean> {
  const url = telegramUrl(botToken, 'setWebhook');

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secretToken,
      allowed_updates: ['message', 'my_chat_member'],
    }),
  });

  const result = await response.json() as { ok: boolean };
  return result.ok;
}
