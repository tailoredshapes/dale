import { createRoom, getRoom, listRoomsForTenant, updateRoom, deleteRoom } from '../../db/rooms.js';
import type { AuthContext } from '../middleware/auth.js';

export async function handleListRooms(
  auth: AuthContext,
): Promise<{ statusCode: number; body: string }> {
  const rooms = await listRoomsForTenant(auth.tenantId);
  return {
    statusCode: 200,
    body: JSON.stringify(rooms.map((r) => ({
      roomId: r.id,
      name: r.name,
      description: r.description,
      telegramGroupId: r.telegram_group_id,
      paymentLink: r.payment_link,
      paypalPaymentLink: r.paypal_payment_link,
      priceDescription: r.price_description,
      isActive: r.active,
    }))),
  };
}

export async function handleGetRoom(
  auth: AuthContext,
  roomId: string,
): Promise<{ statusCode: number; body: string }> {
  const room = await getRoom(auth.tenantId, roomId);
  if (!room) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Room not found' }) };
  }
  return {
    statusCode: 200,
    body: JSON.stringify({
      roomId: room.id,
      name: room.name,
      description: room.description,
      telegramGroupId: room.telegram_group_id,
      paymentLink: room.payment_link,
      paypalPaymentLink: room.paypal_payment_link,
      priceDescription: room.price_description,
      isActive: room.active,
    }),
  };
}

export async function handleCreateRoom(
  auth: AuthContext,
  body: string,
): Promise<{ statusCode: number; body: string }> {
  let parsed: { name: string; description?: string; paymentLink?: string; paypalPaymentLink?: string; priceDescription?: string };
  try {
    parsed = JSON.parse(body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  if (!parsed.name) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required field: name' }) };
  }

  // Room is active only if at least one payment link is provided
  const hasPaymentLink = !!(parsed.paymentLink || parsed.paypalPaymentLink);

  // Let meshql-rs restlette generate the ID
  const room = await createRoom({
    tenant_id: auth.tenantId,
    name: parsed.name,
    description: parsed.description,
    payment_link: parsed.paymentLink ?? '',
    paypal_payment_link: parsed.paypalPaymentLink,
    price_description: parsed.priceDescription,
    active: hasPaymentLink,
  });

  return {
    statusCode: 201,
    body: JSON.stringify({ roomId: room.id, name: room.name }),
  };
}

export async function handleUpdateRoom(
  auth: AuthContext,
  roomId: string,
  body: string,
): Promise<{ statusCode: number; body: string }> {
  let parsed: { name?: string; description?: string; paymentLink?: string; paypalPaymentLink?: string; priceDescription?: string; isActive?: boolean };
  try {
    parsed = JSON.parse(body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  // Map camelCase input to snake_case
  const updates: Record<string, unknown> = {};
  if (parsed.name !== undefined) updates.name = parsed.name;
  if (parsed.description !== undefined) updates.description = parsed.description;
  if (parsed.paymentLink !== undefined) updates.payment_link = parsed.paymentLink;
  if (parsed.paypalPaymentLink !== undefined) updates.paypal_payment_link = parsed.paypalPaymentLink;
  if (parsed.priceDescription !== undefined) updates.price_description = parsed.priceDescription;
  if (parsed.isActive !== undefined) updates.active = parsed.isActive;

  await updateRoom(auth.tenantId, roomId, updates);
  return { statusCode: 200, body: JSON.stringify({ updated: true }) };
}

export async function handleDeleteRoom(
  auth: AuthContext,
  roomId: string,
): Promise<{ statusCode: number; body: string }> {
  const room = await getRoom(auth.tenantId, roomId);
  if (!room) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Room not found' }) };
  }

  await deleteRoom(auth.tenantId, roomId);
  return { statusCode: 200, body: JSON.stringify({ deleted: true }) };
}
