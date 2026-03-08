import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getPlatformConfig } from '../shared/config.js';
import { getTenantSecrets } from '../shared/tenant-config.js';
import { verifyPayPalWebhook } from './verify.js';
import {
  handleSubscriptionActivated,
  handleSubscriptionCancelled,
  handleSubscriptionSuspended,
  handlePaymentCompleted,
  handlePaymentDenied,
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

  if (!tenantSecrets.paypalClientId || !tenantSecrets.paypalClientSecret || !tenantSecrets.paypalWebhookId) {
    return { statusCode: 400, body: 'PayPal not configured for this tenant' };
  }

  if (!event.body) {
    return { statusCode: 400, body: 'Missing body' };
  }

  const verified = await verifyPayPalWebhook(config.paypalBaseUrl, event.headers, event.body, tenantSecrets);
  if (!verified) {
    return { statusCode: 400, body: 'Invalid signature' };
  }

  let paypalEvent: Record<string, unknown>;
  try {
    paypalEvent = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Invalid JSON body' };
  }

  const eventType = paypalEvent.event_type as string;

  try {
    switch (eventType) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        await handleSubscriptionActivated(
          tenantId,
          tenantSecrets.telegramBotToken,
          paypalEvent,
        );
        break;
      case 'BILLING.SUBSCRIPTION.CANCELLED':
        await handleSubscriptionCancelled(
          tenantId,
          tenantSecrets.telegramBotToken,
          paypalEvent,
        );
        break;
      case 'BILLING.SUBSCRIPTION.SUSPENDED':
        await handleSubscriptionSuspended(
          tenantId,
          tenantSecrets.telegramBotToken,
          paypalEvent,
        );
        break;
      case 'PAYMENT.SALE.COMPLETED':
        await handlePaymentCompleted(
          tenantId,
          paypalEvent,
        );
        break;
      case 'PAYMENT.SALE.DENIED':
        await handlePaymentDenied(
          tenantId,
          tenantSecrets.telegramBotToken,
          paypalEvent,
        );
        break;
      default:
        console.log(`Unhandled PayPal event type: ${eventType}`);
    }

    return { statusCode: 200, body: 'ok' };
  } catch (error) {
    console.error('Error processing PayPal event:', error);
    return { statusCode: 500, body: 'Internal error' };
  }
}
