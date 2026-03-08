export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'none';

// --- Multi-tenant entities (meshql-rs backed) ---

export interface Tenant {
  id: string;
  display_name: string;
  telegram_bot_token?: string;
  webhook_secret?: string;
  stripe_secret_key?: string;
  stripe_webhook_secret?: string;
  paypal_client_id?: string;
  paypal_client_secret?: string;
  paypal_webhook_id?: string;
}

export interface Room {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  telegram_group_id?: string;
  payment_link?: string;
  paypal_payment_link?: string;
  price_description?: string;
  active: boolean;
}

export interface UserRoom {
  id: string;
  tenant_id: string;
  room_id: string;
  telegram_user_id: number;
  telegram_first_name?: string;
  telegram_username?: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  paypal_payer_id?: string;
  paypal_subscription_id?: string;
  subscription_status: SubscriptionStatus;
}

// --- Tenant secrets (now on Tenant object) ---

export interface TenantSecrets {
  telegramBotToken: string;
  telegramWebhookSecret: string;
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  paypalClientId?: string;
  paypalClientSecret?: string;
  paypalWebhookId?: string;
}

// --- Platform config (env vars only) ---

export interface PlatformConfig {
  meshqlUrl: string;
  telegramWebhookUrl: string;
  stripeWebhookUrl: string;
  paypalWebhookUrl: string;
  paypalBaseUrl: string;
}

// --- Telegram types ---

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}

export interface TelegramChat {
  id: number;
  type: string;
  title?: string;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
}

export interface TelegramChatMemberUpdated {
  chat: TelegramChat;
  from: TelegramUser;
  date: number;
  old_chat_member: TelegramChatMember;
  new_chat_member: TelegramChatMember;
}

export interface TelegramChatMember {
  user: TelegramUser;
  status: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  my_chat_member?: TelegramChatMemberUpdated;
}
