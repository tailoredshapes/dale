import { getTenantByPayPalPayer, createPayPalUserRoomMapping } from '../db/paypal-mappings.js';
import { sendMessage } from '../telegram/api.js';
import { getRoom } from '../db/rooms.js';

export function parseCustomId(ref: string | null | undefined): {
  tenantId: string;
  telegramUserId: number;
  roomId: string;
} | null {
  if (!ref) return null;
  const parts = ref.split(':');
  if (parts.length !== 3) return null;
  const telegramUserId = Number(parts[1]);
  if (!parts[0] || !telegramUserId || !parts[2]) return null;
  return { tenantId: parts[0], telegramUserId, roomId: parts[2] };
}

export async function handleSubscriptionActivated(
  tenantId: string,
  botToken: string,
  event: Record<string, unknown>,
): Promise<void> {
  const resource = event.resource as Record<string, unknown>;
  const customId = resource.custom_id as string | undefined;
  const parsed = parseCustomId(customId);
  if (!parsed) {
    console.error('Invalid custom_id in PayPal subscription:', customId);
    return;
  }

  if (parsed.tenantId !== tenantId) {
    console.error('Tenant mismatch in custom_id', { expected: tenantId, got: parsed.tenantId });
    return;
  }

  const subscriber = resource.subscriber as Record<string, unknown> | undefined;
  const paypalPayerId = (subscriber?.payer_id as string) ?? '';
  const paypalSubscriptionId = resource.id as string ?? '';

  if (!paypalPayerId || !paypalSubscriptionId) {
    console.error('Missing payer_id or subscription id in PayPal event');
    return;
  }

  await createPayPalUserRoomMapping(
    tenantId,
    parsed.telegramUserId,
    parsed.roomId,
    paypalPayerId,
    paypalSubscriptionId,
  );

  const room = await getRoom(tenantId, parsed.roomId);
  const groupName = room?.name ?? 'your group';

  await sendMessage(
    botToken,
    parsed.telegramUserId,
    `You're in! \u{1F389} Your subscription to *${groupName}* is now active.`,
  );
}

export async function handleSubscriptionCancelled(
  tenantId: string,
  botToken: string,
  event: Record<string, unknown>,
): Promise<void> {
  const resource = event.resource as Record<string, unknown>;
  const subscriber = resource.subscriber as Record<string, unknown> | undefined;
  const paypalPayerId = (subscriber?.payer_id as string) ?? '';
  if (!paypalPayerId) return;

  const mapping = await getTenantByPayPalPayer(paypalPayerId);
  if (!mapping || mapping.tenant_id !== tenantId) return;

  await sendMessage(
    botToken,
    mapping.telegram_user_id,
    'Your subscription has been cancelled. Use /start to resubscribe anytime.',
  );
}

export async function handleSubscriptionSuspended(
  tenantId: string,
  botToken: string,
  event: Record<string, unknown>,
): Promise<void> {
  const resource = event.resource as Record<string, unknown>;
  const subscriber = resource.subscriber as Record<string, unknown> | undefined;
  const paypalPayerId = (subscriber?.payer_id as string) ?? '';
  if (!paypalPayerId) return;

  const mapping = await getTenantByPayPalPayer(paypalPayerId);
  if (!mapping || mapping.tenant_id !== tenantId) return;

  await sendMessage(
    botToken,
    mapping.telegram_user_id,
    'Your subscription payment is past due. Please update your payment method to keep your subscription active.',
  );
}

export async function handlePaymentCompleted(
  tenantId: string,
  event: Record<string, unknown>,
): Promise<void> {
  console.log(`PayPal payment completed for tenant ${tenantId}`, event.resource);
}

export async function handlePaymentDenied(
  tenantId: string,
  botToken: string,
  event: Record<string, unknown>,
): Promise<void> {
  const resource = event.resource as Record<string, unknown>;

  // For sale events, try to find the payer via billing_agreement_id or custom field
  // The payer email might be available but we need the payer_id for lookup
  const payerInfo = resource.payer_info as Record<string, unknown> | undefined;
  const paypalPayerId = (payerInfo?.payer_id as string) ?? '';
  if (!paypalPayerId) {
    console.warn('No payer_id in PayPal payment denied event');
    return;
  }

  const mapping = await getTenantByPayPalPayer(paypalPayerId);
  if (!mapping || mapping.tenant_id !== tenantId) return;

  await sendMessage(
    botToken,
    mapping.telegram_user_id,
    'Your PayPal payment was denied. Please update your payment method to keep your subscription active.',
  );
}
