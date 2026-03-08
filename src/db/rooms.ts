import { graphql, restPost, restPut, restGet } from './client.js';
import type { Room } from '../shared/types.js';

interface RoomInput {
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

export async function createRoom(
  room: RoomInput,
): Promise<Room> {
  return restPost<Room>('/room/api', room);
}

export async function getRoom(
  tenantId: string,
  roomId: string,
): Promise<Room | null> {
  // First get by ID, then verify tenant_id matches
  const room = await restGet<Room>('/room/api', roomId);
  if (room && room.tenant_id === tenantId) {
    return room;
  }
  return null;
}

export async function getRoomById(
  roomId: string,
): Promise<Room | null> {
  return restGet<Room>('/room/api', roomId);
}

export async function listRoomsForTenant(
  tenantId: string,
): Promise<Room[]> {
  const query = `
    query GetByTenantId($tenant_id: String) {
      getByTenantId(tenant_id: $tenant_id) {
        id
        tenant_id
        name
        description
        telegram_group_id
        payment_link
        paypal_payment_link
        price_description
        active
      }
    }
  `;
  const result = await graphql<{ getByTenantId: Room[] }>(
    '/room/graph',
    query,
    { tenant_id: tenantId },
  );
  return result.getByTenantId ?? [];
}

export async function getRoomByTelegramGroupId(
  telegramGroupId: number,
): Promise<Room | null> {
  const query = `
    query GetByTelegramGroupId($telegram_group_id: String) {
      getByTelegramGroupId(telegram_group_id: $telegram_group_id) {
        id
        tenant_id
        name
        description
        telegram_group_id
        payment_link
        paypal_payment_link
        price_description
        active
      }
    }
  `;
  const result = await graphql<{ getByTelegramGroupId: Room | null }>(
    '/room/graph',
    query,
    { telegram_group_id: String(telegramGroupId) },
  );
  return result.getByTelegramGroupId;
}

export async function updateRoom(
  tenantId: string,
  roomId: string,
  updates: Partial<Omit<RoomInput, 'id' | 'tenant_id'>>,
): Promise<Room> {
  // Verify tenant owns the room first
  const existing = await getRoom(tenantId, roomId);
  if (!existing) {
    throw new Error(`Room ${roomId} not found for tenant ${tenantId}`);
  }
  return restPut<Room>('/room/api', roomId, updates);
}
