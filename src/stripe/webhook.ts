import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import Stripe from 'stripe';
import { getPlatformConfig } from '../shared/config.js';
import { getTenantSecrets } from '../shared/tenant-config.js';
import {
  handleCheckoutCompleted,
  handleInvoicePaid,
  handleInvoicePaymentFailed,
  handleSubscriptionDeleted,
  handleSubscriptionUpdated,
} from './events.js';

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  const config = getPlatformConfig();

  // Extract tenant from query string
  const tenantId = event.queryStringParameters?.tenant;
  if (!tenantId) {
    return { statusCode: 400, body: 'Missing tenant parameter' };
  }

  let tenantSecrets;
  try {
    tenantSecrets = await getTenantSecrets(tenantId);
  } catch (err) {
    console.error(`Failed to load secrets for tenant ${tenantId}:`, err);
    return { statusCode: 500, body: 'Tenant configuration error' };
  }

  const skipVerify = process.env.SKIP_STRIPE_SIGNATURE_VERIFY === 'true';

  if (!skipVerify && (!tenantSecrets.stripeSecretKey || !tenantSecrets.stripeWebhookSecret)) {
    return { statusCode: 400, body: 'Stripe not configured for this tenant' };
  }

  const stripe = new Stripe(tenantSecrets.stripeSecretKey || 'sk_test_fake');

  let stripeEvent: Stripe.Event;

  if (skipVerify) {
    // Staging/local mode: skip signature verification, parse body directly
    if (!event.body) {
      return { statusCode: 400, body: 'Missing body' };
    }
    try {
      stripeEvent = JSON.parse(event.body) as Stripe.Event;
    } catch (err) {
      console.error('Failed to parse Stripe event body:', err);
      return { statusCode: 400, body: 'Invalid JSON body' };
    }
  } else {
    const signature = event.headers['stripe-signature'];
    if (!signature || !event.body) {
      return { statusCode: 400, body: 'Missing signature or body' };
    }

    try {
      stripeEvent = stripe.webhooks.constructEvent(
        event.body,
        signature,
        tenantSecrets.stripeWebhookSecret,
      );
    } catch (err) {
      console.error('Stripe signature verification failed:', err);
      return { statusCode: 400, body: 'Invalid signature' };
    }
  }

  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(
          tenantId,
          tenantSecrets.telegramBotToken,
          stripeEvent.data.object as Stripe.Checkout.Session,
        );
        break;
      case 'invoice.paid':
        await handleInvoicePaid(
          tenantId,
          tenantSecrets.telegramBotToken,
          stripeEvent.data.object as Stripe.Invoice,
        );
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(
          tenantId,
          tenantSecrets.telegramBotToken,
          stripeEvent.data.object as Stripe.Invoice,
        );
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(
          tenantId,
          tenantSecrets.telegramBotToken,
          stripeEvent.data.object as Stripe.Subscription,
        );
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(
          tenantId,
          tenantSecrets.telegramBotToken,
          stripeEvent.data.object as Stripe.Subscription,
        );
        break;
      default:
        console.log(`Unhandled event type: ${stripeEvent.type}`);
    }

    return { statusCode: 200, body: 'ok' };
  } catch (error) {
    console.error('Error processing Stripe event:', error);
    return { statusCode: 500, body: 'Internal error' };
  }
}
