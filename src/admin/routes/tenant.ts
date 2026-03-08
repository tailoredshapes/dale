import { getTenantById, createTenant, updateTenant } from '../../db/tenants.js';
import type { AuthContext } from '../middleware/auth.js';

export async function handleGetTenant(
  auth: AuthContext,
): Promise<{ statusCode: number; body: string }> {
  const tenant = await getTenantById(auth.tenantId);
  if (!tenant) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Tenant not found' }) };
  }
  return {
    statusCode: 200,
    body: JSON.stringify({
      tenantId: tenant.id,
      displayName: tenant.display_name,
    }),
  };
}

export async function handleUpdateTenant(
  auth: AuthContext,
  body: string,
): Promise<{ statusCode: number; body: string }> {
  let parsed: { displayName?: string };
  try {
    parsed = JSON.parse(body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  await updateTenant(auth.tenantId, { display_name: parsed.displayName });
  return { statusCode: 200, body: JSON.stringify({ updated: true }) };
}

const PAYPAL_WEBHOOK_EVENT_TYPES = [
  'BILLING.SUBSCRIPTION.ACTIVATED',
  'BILLING.SUBSCRIPTION.CANCELLED',
  'BILLING.SUBSCRIPTION.SUSPENDED',
  'PAYMENT.SALE.COMPLETED',
  'PAYMENT.SALE.DENIED',
];

export async function handleOnboard(
  cognitoSub: string,
  body: string,
  deps: {
    generateSecret: () => string;
    setWebhook: (botToken: string, webhookUrl: string, secretToken: string) => Promise<boolean>;
    registerPayPalWebhook: (baseUrl: string, clientId: string, clientSecret: string, webhookUrl: string, eventTypes: string[]) => Promise<string>;
    telegramWebhookUrl: string;
    stripeWebhookUrl: string;
    paypalWebhookUrl: string;
    paypalBaseUrl: string;
  },
): Promise<{ statusCode: number; body: string }> {
  let parsed: {
    displayName: string;
    telegramBotToken: string;
    stripeSecretKey?: string;
    stripeWebhookSecret?: string;
    paypalClientId?: string;
    paypalClientSecret?: string;
  };
  try {
    parsed = JSON.parse(body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  if (!parsed.displayName || !parsed.telegramBotToken) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  const hasStripe = !!(parsed.stripeSecretKey && parsed.stripeWebhookSecret);
  const hasPayPal = !!(parsed.paypalClientId && parsed.paypalClientSecret);

  const webhookSecret = deps.generateSecret();

  // Create tenant first to get the meshql-rs generated ID
  const createdTenant = await createTenant({
    display_name: parsed.displayName,
    telegram_bot_token: parsed.telegramBotToken,
    webhook_secret: webhookSecret,
    stripe_secret_key: hasStripe ? parsed.stripeSecretKey : undefined,
    stripe_webhook_secret: hasStripe ? parsed.stripeWebhookSecret : undefined,
    paypal_client_id: hasPayPal ? parsed.paypalClientId : undefined,
    paypal_client_secret: hasPayPal ? parsed.paypalClientSecret : undefined,
  });
  const tenantId = createdTenant.id;

  // Register PayPal webhook after tenant creation (need real tenantId for webhook URL)
  if (hasPayPal) {
    try {
      const webhookUrl = `${deps.paypalWebhookUrl}?tenant=${tenantId}`;
      const paypalWebhookId = await deps.registerPayPalWebhook(
        deps.paypalBaseUrl,
        parsed.paypalClientId!,
        parsed.paypalClientSecret!,
        webhookUrl,
        PAYPAL_WEBHOOK_EVENT_TYPES,
      );
      // Update tenant with the PayPal webhook ID
      await updateTenant(tenantId, { paypal_webhook_id: paypalWebhookId });
    } catch (err) {
      console.error('PayPal webhook registration failed:', err);
      return { statusCode: 502, body: JSON.stringify({ error: 'PayPal webhook registration failed' }) };
    }
  }

  // Register Telegram webhook
  const webhookRegistered = await deps.setWebhook(
    parsed.telegramBotToken,
    deps.telegramWebhookUrl,
    webhookSecret,
  );

  const response: Record<string, unknown> = {
    tenantId,
    webhookSecret,
    webhookRegistered,
  };
  if (hasStripe) {
    response.stripeWebhookUrl = `${deps.stripeWebhookUrl}?tenant=${tenantId}`;
    response.stripeWebhookSecret = parsed.stripeWebhookSecret;
  }
  if (hasPayPal) {
    response.paypalWebhookUrl = `${deps.paypalWebhookUrl}?tenant=${tenantId}`;
  }

  return {
    statusCode: 201,
    body: JSON.stringify(response),
  };
}

export async function handleConfigurePayment(
  auth: AuthContext,
  body: string,
  deps: {
    registerPayPalWebhook: (baseUrl: string, clientId: string, clientSecret: string, webhookUrl: string, eventTypes: string[]) => Promise<string>;
    stripeWebhookUrl: string;
    paypalWebhookUrl: string;
    paypalBaseUrl: string;
  },
): Promise<{ statusCode: number; body: string }> {
  let parsed: {
    stripeSecretKey?: string;
    stripeWebhookSecret?: string;
    paypalClientId?: string;
    paypalClientSecret?: string;
  };
  try {
    parsed = JSON.parse(body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const hasStripe = !!(parsed.stripeSecretKey || parsed.stripeWebhookSecret);
  const hasPayPal = !!(parsed.paypalClientId || parsed.paypalClientSecret);

  if (!hasStripe && !hasPayPal) {
    return { statusCode: 400, body: JSON.stringify({ error: 'At least one payment provider must be specified' }) };
  }

  if (hasStripe && (!parsed.stripeSecretKey || !parsed.stripeWebhookSecret)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Both stripeSecretKey and stripeWebhookSecret are required' }) };
  }

  if (hasPayPal && (!parsed.paypalClientId || !parsed.paypalClientSecret)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Both paypalClientId and paypalClientSecret are required' }) };
  }

  const updates: Record<string, string | undefined> = {};
  const response: Record<string, unknown> = { configured: true };

  if (hasStripe) {
    updates.stripe_secret_key = parsed.stripeSecretKey;
    updates.stripe_webhook_secret = parsed.stripeWebhookSecret;
    response.stripeWebhookUrl = `${deps.stripeWebhookUrl}?tenant=${auth.tenantId}`;
  }

  if (hasPayPal) {
    try {
      const webhookUrl = `${deps.paypalWebhookUrl}?tenant=${auth.tenantId}`;
      const paypalWebhookId = await deps.registerPayPalWebhook(
        deps.paypalBaseUrl,
        parsed.paypalClientId!,
        parsed.paypalClientSecret!,
        webhookUrl,
        PAYPAL_WEBHOOK_EVENT_TYPES,
      );
      updates.paypal_client_id = parsed.paypalClientId;
      updates.paypal_client_secret = parsed.paypalClientSecret;
      updates.paypal_webhook_id = paypalWebhookId;
      response.paypalWebhookUrl = webhookUrl;
    } catch (err) {
      console.error('PayPal webhook registration failed:', err);
      return { statusCode: 502, body: JSON.stringify({ error: 'PayPal webhook registration failed' }) };
    }
  }

  await updateTenant(auth.tenantId, updates);

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
}
