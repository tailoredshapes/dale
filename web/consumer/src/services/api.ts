import { getConfig } from './config';
import { getAuthToken } from './auth';

export interface Room {
  roomId: string;
  name: string;
  description?: string;
  priceDescription?: string;
  paymentLink?: string;
  paypalPaymentLink?: string;
  isActive: boolean;
  tenantId: string;
  tenantDisplayName?: string;
}

export interface Subscription {
  id: string;
  roomId: string;
  roomName: string;
  status: 'active' | 'past_due' | 'cancelled' | 'none';
  telegramInviteLink?: string;
  paymentProvider: 'stripe' | 'paypal';
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

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
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

export async function getPublicRooms(): Promise<Room[]> {
  return request<Room[]>('/api/rooms/public');
}

export async function getRoom(roomId: string): Promise<Room> {
  return request<Room>(`/api/rooms/${roomId}`);
}

export async function getSubscriptions(): Promise<Subscription[]> {
  return request<Subscription[]>('/api/subscriptions');
}

export async function createSubscription(
  roomId: string,
  provider: 'stripe' | 'paypal'
): Promise<{ redirectUrl: string }> {
  return request<{ redirectUrl: string }>('/api/subscribe', {
    method: 'POST',
    body: JSON.stringify({ roomId, provider }),
  });
}

export async function cancelSubscription(subscriptionId: string): Promise<void> {
  await request(`/api/subscribe/${subscriptionId}`, {
    method: 'DELETE',
  });
}
