export interface TenantResponse {
  tenantId: string;
  displayName: string;
  createdAt: string;
}

export interface RoomResponse {
  roomId: string;
  name: string;
  description?: string;
  telegramGroupId?: number;
  paymentLink: string;
  paypalPaymentLink?: string;
  priceDescription?: string;
  isActive: boolean;
  createdAt: string;
}

export interface SubscriberResponse {
  telegramUserId: number;
  roomId: string;
  subscriptionStatus: string;
  createdAt: string;
}

export interface OnboardRequest {
  displayName: string;
  telegramBotToken?: string;
}

export interface ConfigureTelegramRequest {
  telegramBotToken: string;
}

export interface ConfigureTelegramResponse {
  webhookRegistered: boolean;
}

export interface ConfigurePaymentRequest {
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  paypalClientId?: string;
  paypalClientSecret?: string;
}

export interface ConfigurePaymentResponse {
  configured: boolean;
  stripeWebhookUrl?: string;
  paypalWebhookUrl?: string;
}

export interface OnboardResponse {
  tenantId: string;
  webhookRegistered: boolean;
  stripeWebhookUrl?: string;
  paypalWebhookUrl?: string;
}

export interface CreateRoomRequest {
  name: string;
  description?: string;
  paymentLink?: string;
  paypalPaymentLink?: string;
  priceDescription?: string;
}

export interface UpdateRoomRequest {
  name?: string;
  description?: string;
  paymentLink?: string;
  paypalPaymentLink?: string;
  priceDescription?: string;
  isActive?: boolean;
}

export interface InviteRequest {
  email: string;
}

export interface InviteResponse {
  email: string;
  invited: boolean;
}

export interface AdminUser {
  email: string;
  status: string;
  createdAt: string;
}
