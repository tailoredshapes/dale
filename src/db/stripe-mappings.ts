import { graphql, restPost } from './client.js';
import type { UserRoom } from '../shared/types.js';

interface UserRoomWithStripe {
  tenant_id: string;
  room_id: string;
  telegram_user_id: number;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  subscription_status: 'active' | 'past_due' | 'cancelled' | 'none';
}

export async function getTenantByStripeCustomer(
  stripeCustomerId: string,
): Promise<{ tenant_id: string; telegram_user_id: number } | null> {
  const query = `
    query GetByStripeCustomerId($stripe_customer_id: String) {
      getByStripeCustomerId(stripe_customer_id: $stripe_customer_id) {
        id
        tenant_id
        telegram_user_id
        stripe_customer_id
      }
    }
  `;
  const result = await graphql<{ getByStripeCustomerId: UserRoom | null }>(
    '/user_room/graph',
    query,
    { stripe_customer_id: stripeCustomerId },
  );

  if (result.getByStripeCustomerId) {
    return {
      tenant_id: result.getByStripeCustomerId.tenant_id,
      telegram_user_id: result.getByStripeCustomerId.telegram_user_id,
    };
  }
  return null;
}

export async function createUserRoomMapping(
  tenantId: string,
  telegramUserId: number,
  roomId: string,
  stripeCustomerId: string,
  stripeSubscriptionId: string,
  firstName?: string,
  username?: string,
): Promise<void> {
  // Let meshql-rs restlette generate the ID
  const userRoom: UserRoomWithStripe = {
    tenant_id: tenantId,
    room_id: roomId,
    telegram_user_id: telegramUserId,
    stripe_customer_id: stripeCustomerId,
    stripe_subscription_id: stripeSubscriptionId,
    subscription_status: 'active',
  };

  // Add optional fields
  const data: Record<string, unknown> = { ...userRoom };
  if (firstName) data.telegram_first_name = firstName;
  if (username) data.telegram_username = username;

  await restPost<UserRoom>('/user_room/api', data);
}
