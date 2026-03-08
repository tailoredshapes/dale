import { listRoomSubscribers } from '../../db/users.js';
import type { AuthContext } from '../middleware/auth.js';

export async function handleListSubscribers(
  auth: AuthContext,
  roomId: string,
): Promise<{ statusCode: number; body: string }> {
  const subscribers = await listRoomSubscribers(auth.tenantId, roomId);
  return {
    statusCode: 200,
    body: JSON.stringify(subscribers.map((s) => ({
      telegramUserId: s.telegram_user_id,
      roomId: s.room_id,
      subscriptionStatus: s.subscription_status,
    }))),
  };
}
