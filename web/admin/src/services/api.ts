import { getConfig } from './config';
import { getAuthToken } from './auth';

export interface Tenant {
  tenantId: string;
  displayName: string;
  status: 'active' | 'suspended';
  roomCount?: number;
  subscriberCount?: number;
  monthlyRevenue?: number;
  createdAt?: string;
}

export interface TenantDetails extends Tenant {
  rooms: Room[];
  recentSubscribers: Subscriber[];
}

export interface Room {
  roomId: string;
  name: string;
  description?: string;
  priceDescription?: string;
  isActive: boolean;
  subscriberCount?: number;
}

export interface Subscriber {
  telegramUserId: number;
  telegramUsername?: string;
  telegramFirstName?: string;
  roomId: string;
  roomName?: string;
  subscriptionStatus: 'active' | 'past_due' | 'cancelled' | 'none';
}

export interface PlatformStats {
  totalTenants: number;
  activeTenants: number;
  totalSubscriptions: number;
  activeSubscriptions: number;
  mrr: number;
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

export async function getPlatformStats(): Promise<PlatformStats> {
  return request<PlatformStats>('/api/admin/stats');
}

export async function getTenants(): Promise<Tenant[]> {
  return request<Tenant[]>('/api/admin/tenants');
}

export async function getTenant(tenantId: string): Promise<TenantDetails> {
  return request<TenantDetails>(`/api/admin/tenants/${tenantId}`);
}

export async function createTenant(data: {
  displayName: string;
  email: string;
}): Promise<{ tenantId: string }> {
  return request<{ tenantId: string }>('/api/admin/tenants', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function suspendTenant(tenantId: string): Promise<void> {
  await request(`/api/admin/tenants/${tenantId}/suspend`, {
    method: 'POST',
  });
}

export async function unsuspendTenant(tenantId: string): Promise<void> {
  await request(`/api/admin/tenants/${tenantId}/unsuspend`, {
    method: 'POST',
  });
}

export async function inviteUser(email: string): Promise<void> {
  await request('/api/admin/invite', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function getUsers(): Promise<Array<{
  email: string;
  status: string;
  createdAt: string;
}>> {
  return request('/api/admin/users');
}
