/**
 * PayPal webhook helpers for E2E tests
 * Note: In local mode, PayPal verification is typically bypassed/mocked
 */

export interface PayPalWebhookResult {
  status: number;
  body: string;
}

export interface PayPalEvent {
  id: string;
  event_type: string;
  resource: Record<string, unknown>;
  create_time: string;
  resource_type: string;
  summary: string;
}

/**
 * Send a PayPal webhook event
 * In local mode, signature verification is typically bypassed
 */
export async function sendPayPalWebhook(
  url: string,
  tenantId: string,
  event: PayPalEvent,
): Promise<PayPalWebhookResult> {
  const payload = JSON.stringify(event);

  const response = await fetch(`${url}?tenant=${tenantId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // PayPal webhook headers - in local mode these may be bypassed
      'paypal-transmission-id': `test-${Date.now()}`,
      'paypal-transmission-time': new Date().toISOString(),
      'paypal-transmission-sig': 'test-signature',
      'paypal-cert-url': 'https://api.sandbox.paypal.com/v1/notifications/certs/test',
      'paypal-auth-algo': 'SHA256withRSA',
    },
    body: payload,
  });

  return {
    status: response.status,
    body: await response.text(),
  };
}

/**
 * Build a PayPal BILLING.SUBSCRIPTION.ACTIVATED event
 */
export function buildSubscriptionActivatedEvent(
  tenantId: string,
  telegramUserId: number,
  roomId: string,
  paypalPayerId: string,
  paypalSubscriptionId: string,
): PayPalEvent {
  return {
    id: `WH-${Date.now()}`,
    event_type: 'BILLING.SUBSCRIPTION.ACTIVATED',
    resource_type: 'subscription',
    create_time: new Date().toISOString(),
    summary: 'Subscription activated',
    resource: {
      id: paypalSubscriptionId,
      custom_id: `${tenantId}:${telegramUserId}:${roomId}`,
      status: 'ACTIVE',
      subscriber: {
        payer_id: paypalPayerId,
        name: { given_name: 'Test', surname: 'User' },
        email_address: 'test@example.com',
      },
    },
  };
}

/**
 * Build a PayPal BILLING.SUBSCRIPTION.CANCELLED event
 */
export function buildSubscriptionCancelledEvent(
  paypalPayerId: string,
  paypalSubscriptionId: string,
): PayPalEvent {
  return {
    id: `WH-${Date.now()}`,
    event_type: 'BILLING.SUBSCRIPTION.CANCELLED',
    resource_type: 'subscription',
    create_time: new Date().toISOString(),
    summary: 'Subscription cancelled',
    resource: {
      id: paypalSubscriptionId,
      status: 'CANCELLED',
      subscriber: {
        payer_id: paypalPayerId,
        name: { given_name: 'Test', surname: 'User' },
        email_address: 'test@example.com',
      },
    },
  };
}

/**
 * Build a PayPal BILLING.SUBSCRIPTION.SUSPENDED event
 */
export function buildSubscriptionSuspendedEvent(
  paypalPayerId: string,
  paypalSubscriptionId: string,
): PayPalEvent {
  return {
    id: `WH-${Date.now()}`,
    event_type: 'BILLING.SUBSCRIPTION.SUSPENDED',
    resource_type: 'subscription',
    create_time: new Date().toISOString(),
    summary: 'Subscription suspended',
    resource: {
      id: paypalSubscriptionId,
      status: 'SUSPENDED',
      subscriber: {
        payer_id: paypalPayerId,
        name: { given_name: 'Test', surname: 'User' },
        email_address: 'test@example.com',
      },
    },
  };
}

/**
 * Build a PayPal event with no custom_id
 */
export function buildSubscriptionActivatedNoCustomId(
  paypalPayerId: string,
  paypalSubscriptionId: string,
): PayPalEvent {
  return {
    id: `WH-${Date.now()}`,
    event_type: 'BILLING.SUBSCRIPTION.ACTIVATED',
    resource_type: 'subscription',
    create_time: new Date().toISOString(),
    summary: 'Subscription activated',
    resource: {
      id: paypalSubscriptionId,
      status: 'ACTIVE',
      subscriber: {
        payer_id: paypalPayerId,
        name: { given_name: 'Test', surname: 'User' },
        email_address: 'test@example.com',
      },
    },
  };
}

/**
 * Build a PayPal event with wrong tenant in custom_id
 */
export function buildSubscriptionActivatedWrongTenant(
  wrongTenantId: string,
  paypalPayerId: string,
  paypalSubscriptionId: string,
): PayPalEvent {
  return {
    id: `WH-${Date.now()}`,
    event_type: 'BILLING.SUBSCRIPTION.ACTIVATED',
    resource_type: 'subscription',
    create_time: new Date().toISOString(),
    summary: 'Subscription activated',
    resource: {
      id: paypalSubscriptionId,
      custom_id: `${wrongTenantId}:123:room-id`,
      status: 'ACTIVE',
      subscriber: {
        payer_id: paypalPayerId,
        name: { given_name: 'Test', surname: 'User' },
        email_address: 'test@example.com',
      },
    },
  };
}
