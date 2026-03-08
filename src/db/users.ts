import { graphql, restPost, restPut, restGet } from './client.js';
import type { SubscriptionStatus, UserRoom } from '../shared/types.js';

interface UserRoomInput {
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

export async function getUserRoom(
  tenantId: string,
  telegramUserId: number,
  roomId: string,
): Promise<UserRoom | null> {
  const query = `
    query GetByTenantUserRoom($tenant_id: String, $telegram_user_id: Int, $room_id: String) {
      getByTenantUserRoom(tenant_id: $tenant_id, telegram_user_id: $telegram_user_id, room_id: $room_id) {
        id
        tenant_id
        room_id
        telegram_user_id
        telegram_first_name
        telegram_username
        stripe_customer_id
        stripe_subscription_id
        paypal_payer_id
        paypal_subscription_id
        subscription_status
      }
    }
  `;
  const result = await graphql<{ getByTenantUserRoom: UserRoom | null }>(
    '/user_room/graph',
    query,
    { tenant_id: tenantId, telegram_user_id: telegramUserId, room_id: roomId },
  );
  return result.getByTenantUserRoom;
}

export async function listUserRooms(
  tenantId: string,
  telegramUserId: number,
): Promise<UserRoom[]> {
  const query = `
    query GetByTenantAndUser($tenant_id: String, $telegram_user_id: Int) {
      getByTenantAndUser(tenant_id: $tenant_id, telegram_user_id: $telegram_user_id) {
        id
        tenant_id
        room_id
        telegram_user_id
        telegram_first_name
        telegram_username
        stripe_customer_id
        stripe_subscription_id
        paypal_payer_id
        paypal_subscription_id
        subscription_status
      }
    }
  `;
  const result = await graphql<{ getByTenantAndUser: UserRoom[] }>(
    '/user_room/graph',
    query,
    { tenant_id: tenantId, telegram_user_id: telegramUserId },
  );
  return result.getByTenantAndUser ?? [];
}

export async function listRoomSubscribers(
  tenantId: string,
  roomId: string,
): Promise<UserRoom[]> {
  const query = `
    query GetByTenantAndRoom($tenant_id: String, $room_id: String) {
      getByTenantAndRoom(tenant_id: $tenant_id, room_id: $room_id) {
        id
        tenant_id
        room_id
        telegram_user_id
        telegram_first_name
        telegram_username
        stripe_customer_id
        stripe_subscription_id
        paypal_payer_id
        paypal_subscription_id
        subscription_status
      }
    }
  `;
  const result = await graphql<{ getByTenantAndRoom: UserRoom[] }>(
    '/user_room/graph',
    query,
    { tenant_id: tenantId, room_id: roomId },
  );
  return result.getByTenantAndRoom ?? [];
}

export async function updateUserRoomStatus(
  tenantId: string,
  telegramUserId: number,
  roomId: string,
  status: SubscriptionStatus,
  stripeSubscriptionId?: string,
): Promise<void> {
  // Find the existing user room
  const existing = await getUserRoom(tenantId, telegramUserId, roomId);
  if (!existing) {
    throw new Error(`UserRoom not found for tenant ${tenantId}, user ${telegramUserId}, room ${roomId}`);
  }

  const updates: Partial<UserRoomInput> = {
    subscription_status: status,
  };
  if (stripeSubscriptionId) {
    updates.stripe_subscription_id = stripeSubscriptionId;
  }

  await restPut<UserRoom>('/user_room/api', existing.id, updates);
}

export async function createUserRoom(
  userRoom: UserRoomInput,
): Promise<UserRoom> {
  return restPost<UserRoom>('/user_room/api', userRoom);
}

export async function getUserRoomById(
  userRoomId: string,
): Promise<UserRoom | null> {
  return restGet<UserRoom>('/user_room/api', userRoomId);
}
