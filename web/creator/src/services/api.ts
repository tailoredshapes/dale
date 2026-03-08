import { getConfig } from './config';
import { getAuthToken, getWebhookSecret, setTenantInfo } from './auth';

export interface Room {
  roomId: string;
  name: string;
  description?: string;
  telegramGroupId?: string;
  paymentLink?: string;
  paypalPaymentLink?: string;
  priceDescription?: string;
  isActive: boolean;
  subscriberCount?: number;
}

export interface Subscriber {
  telegramUserId: number;
  telegramUsername?: string;
  telegramFirstName?: string;
  roomId: string;
  subscriptionStatus: 'active' | 'past_due' | 'cancelled' | 'none';
}

export interface TenantStats {
  totalSubscribers: number;
  activeSubscribers: number;
  totalRooms: number;
  monthlyRevenue?: number;
}

export interface OnboardingData {
  displayName: string;
  telegramBotToken: string;
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  paypalClientId?: string;
  paypalClientSecret?: string;
}

export interface ApiError {
  error: string;
  status: number;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const config = getConfig();
  const token = getAuthToken();
  const webhookSecret = getWebhookSecret();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (webhookSecret) {
    headers['X-Webhook-Secret'] = webhookSecret;
  }

  const response = await fetch(`${config.apiUrl}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error: ApiError = {
      error: await response.text(),
      status: response.status,
    };
    throw error;
  }

  return response.json();
}

export async function onboardTenant(data: OnboardingData): Promise<{
  tenantId: string;
  webhookSecret: string;
}> {
  const result = await request<{
    tenantId: string;
    webhookRegistered: boolean;
  }>('/api/tenant/onboard', {
    method: 'POST',
    body: JSON.stringify(data),
  });

  const tenantDetails = await request<{
    tenantId: string;
    displayName: string;
    webhookSecret: string;
  }>('/api/tenant', {
    headers: {
      'X-Webhook-Secret': result.tenantId,
    },
  });

  setTenantInfo({
    tenantId: result.tenantId,
    webhookSecret: tenantDetails.webhookSecret || result.tenantId,
    displayName: data.displayName,
    isOnboarded: true,
  });

  return {
    tenantId: result.tenantId,
    webhookSecret: tenantDetails.webhookSecret || result.tenantId,
  };
}

export async function getTenant(): Promise<{
  tenantId: string;
  displayName: string;
}> {
  return request<{
    tenantId: string;
    displayName: string;
  }>('/api/tenant');
}

export async function updateTenant(data: { displayName?: string }): Promise<void> {
  await request('/api/tenant', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function getRooms(): Promise<Room[]> {
  return request<Room[]>('/api/rooms');
}

export async function getRoom(roomId: string): Promise<Room> {
  return request<Room>(`/api/rooms/${roomId}`);
}

export async function createRoom(data: {
  name: string;
  description?: string;
  paymentLink?: string;
  paypalPaymentLink?: string;
  priceDescription?: string;
}): Promise<Room> {
  return request<Room>('/api/rooms', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateRoom(
  roomId: string,
  data: Partial<Room>
): Promise<void> {
  await request(`/api/rooms/${roomId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function getRoomSubscribers(roomId: string): Promise<Subscriber[]> {
  return request<Subscriber[]>(`/api/rooms/${roomId}/subscribers`);
}

export async function getTenantStats(): Promise<TenantStats> {
  const rooms = await getRooms();
  let totalSubscribers = 0;
  let activeSubscribers = 0;

  for (const room of rooms) {
    if (room.subscriberCount) {
      totalSubscribers += room.subscriberCount;
    }
  }

  return {
    totalRooms: rooms.length,
    totalSubscribers,
    activeSubscribers: totalSubscribers,
  };
}
