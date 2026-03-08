/**
 * Stripe webhook helpers for E2E tests
 */
import Stripe from 'stripe';
import type { E2EConfig } from '../env.js';
import { getSSMParameter } from './ssm.js';

export interface StripeWebhookResult {
  status: number;
  body: string;
}

/**
 * Get the Stripe webhook secret for a tenant
 */
export async function getStripeWebhookSecret(
  tenantId: string,
  config: E2EConfig,
): Promise<string> {
  return getSSMParameter(`/dale/tenants/${tenantId}/stripe-webhook-secret`, config);
}

/**
 * Generate a valid Stripe webhook signature for testing
 */
export function generateStripeSignature(
  payload: string,
  secret: string,
): string {
  return Stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
  });
}

/**
 * Send a signed Stripe webhook event
 */
export async function sendStripeWebhook(
  url: string,
  tenantId: string,
  secret: string,
  event: Stripe.Event,
): Promise<StripeWebhookResult> {
  const payload = JSON.stringify(event);
  const signature = generateStripeSignature(payload, secret);

  const response = await fetch(`${url}?tenant=${tenantId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': signature,
    },
    body: payload,
  });

  return {
    status: response.status,
    body: await response.text(),
  };
}

/**
 * Build a Stripe checkout.session.completed event
 */
export function buildCheckoutCompletedEvent(
  tenantId: string,
  telegramUserId: number,
  roomId: string,
  stripeCustomerId: string,
  stripeSubscriptionId: string,
): Stripe.Event {
  return {
    id: `evt_test_${Date.now()}`,
    object: 'event',
    api_version: '2024-04-10',
    created: Math.floor(Date.now() / 1000),
    type: 'checkout.session.completed',
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
    data: {
      object: {
        id: `cs_test_${Date.now()}`,
        object: 'checkout.session',
        client_reference_id: `${tenantId}:${telegramUserId}:${roomId}`,
        customer: stripeCustomerId,
        subscription: stripeSubscriptionId,
        mode: 'subscription',
        payment_status: 'paid',
        status: 'complete',
      } as unknown as Stripe.Checkout.Session,
    },
  };
}

/**
 * Build a Stripe invoice.paid event
 */
export function buildInvoicePaidEvent(
  stripeCustomerId: string,
  stripeSubscriptionId?: string,
): Stripe.Event {
  return {
    id: `evt_test_${Date.now()}`,
    object: 'event',
    api_version: '2024-04-10',
    created: Math.floor(Date.now() / 1000),
    type: 'invoice.paid',
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
    data: {
      object: {
        id: `in_test_${Date.now()}`,
        object: 'invoice',
        customer: stripeCustomerId,
        subscription: stripeSubscriptionId,
        status: 'paid',
        paid: true,
      } as unknown as Stripe.Invoice,
    },
  };
}

/**
 * Build a Stripe invoice.payment_failed event
 */
export function buildInvoicePaymentFailedEvent(
  stripeCustomerId: string,
  stripeSubscriptionId?: string,
): Stripe.Event {
  return {
    id: `evt_test_${Date.now()}`,
    object: 'event',
    api_version: '2024-04-10',
    created: Math.floor(Date.now() / 1000),
    type: 'invoice.payment_failed',
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
    data: {
      object: {
        id: `in_test_${Date.now()}`,
        object: 'invoice',
        customer: stripeCustomerId,
        subscription: stripeSubscriptionId,
        status: 'open',
        paid: false,
      } as unknown as Stripe.Invoice,
    },
  };
}

/**
 * Build a Stripe customer.subscription.deleted event
 */
export function buildSubscriptionDeletedEvent(
  stripeCustomerId: string,
  stripeSubscriptionId: string,
): Stripe.Event {
  return {
    id: `evt_test_${Date.now()}`,
    object: 'event',
    api_version: '2024-04-10',
    created: Math.floor(Date.now() / 1000),
    type: 'customer.subscription.deleted',
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
    data: {
      object: {
        id: stripeSubscriptionId,
        object: 'subscription',
        customer: stripeCustomerId,
        status: 'canceled',
      } as unknown as Stripe.Subscription,
    },
  };
}

/**
 * Build a Stripe customer.subscription.updated event
 */
export function buildSubscriptionUpdatedEvent(
  stripeCustomerId: string,
  stripeSubscriptionId: string,
  status: string,
): Stripe.Event {
  return {
    id: `evt_test_${Date.now()}`,
    object: 'event',
    api_version: '2024-04-10',
    created: Math.floor(Date.now() / 1000),
    type: 'customer.subscription.updated',
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
    data: {
      object: {
        id: stripeSubscriptionId,
        object: 'subscription',
        customer: stripeCustomerId,
        status: status,
      } as unknown as Stripe.Subscription,
    },
  };
}

/**
 * Build a generic Stripe event for testing
 */
export function buildGenericStripeEvent(eventType: string): Stripe.Event {
  return {
    id: `evt_test_${Date.now()}`,
    object: 'event',
    api_version: '2024-04-10',
    created: Math.floor(Date.now() / 1000),
    type: eventType as Stripe.Event['type'],
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
    data: {
      object: {} as any,
    },
  };
}
