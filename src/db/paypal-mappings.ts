import { graphql, restPost } from './client.js';
import type { UserRoom } from '../shared/types.js';

interface UserRoomWithPayPal {
  tenant_id: string;
  room_id: string;
  telegram_user_id: number;
  paypal_payer_id: string;
  paypal_subscription_id: string;
  subscription_status: 'active' | 'past_due' | 'cancelled' | 'none';
}

export async function getTenantByPayPalPayer(
  paypalPayerId: string,
): Promise<{ tenant_id: string; telegram_user_id: number } | null> {
  const query = `
    query GetByPaypalPayerId($paypal_payer_id: String) {
      getByPaypalPayerId(paypal_payer_id: $paypal_payer_id) {
        id
        tenant_id
        telegram_user_id
        paypal_payer_id
      }
    }
  `;
  const result = await graphql<{ getByPaypalPayerId: UserRoom | null }>(
    '/user_room/graph',
    query,
    { paypal_payer_id: paypalPayerId },
  );

  if (result.getByPaypalPayerId) {
    return {
      tenant_id: result.getByPaypalPayerId.tenant_id,
      telegram_user_id: result.getByPaypalPayerId.telegram_user_id,
    };
  }
  return null;
}

export async function createPayPalUserRoomMapping(
  tenantId: string,
  telegramUserId: number,
  roomId: string,
  paypalPayerId: string,
  paypalSubscriptionId: string,
  firstName?: string,
  username?: string,
): Promise<void> {
  // Let meshql-rs restlette generate the ID
  const userRoom: UserRoomWithPayPal = {
    tenant_id: tenantId,
    room_id: roomId,
    telegram_user_id: telegramUserId,
    paypal_payer_id: paypalPayerId,
    paypal_subscription_id: paypalSubscriptionId,
    subscription_status: 'active',
  };

  // Add optional fields
  const data: Record<string, unknown> = { ...userRoom };
  if (firstName) data.telegram_first_name = firstName;
  if (username) data.telegram_username = username;

  await restPost<UserRoom>('/user_room/api', data);
}
