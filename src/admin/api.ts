import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getPlatformConfig } from '../shared/config.js';
import { extractAuthContext, extractCognitoSub, registerTenantForSub } from './middleware/auth.js';
import { handleGetTenant, handleUpdateTenant, handleOnboard, handleConfigurePayment } from './routes/tenant.js';
import { handleListRooms, handleGetRoom, handleCreateRoom, handleUpdateRoom } from './routes/rooms.js';
import { handleListSubscribers } from './routes/subscribers.js';
import { handleRegisterWebhook } from './routes/webhooks.js';
import { handleInviteUser, handleListUsers } from './routes/invite.js';
import { setWebhook } from '../telegram/api.js';
import { registerPayPalWebhook } from '../paypal/client.js';
import { randomBytes } from 'crypto';

function json(result: { statusCode: number; body: string }): APIGatewayProxyResultV2 {
  return {
    statusCode: result.statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Webhook-Secret',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    },
    body: result.body,
  };
}

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  // Handle CORS preflight
  if (event.requestContext.http.method === 'OPTIONS') {
    return json({ statusCode: 200, body: '' });
  }

  const config = getPlatformConfig();
  const method = event.requestContext.http.method;
  const path = event.rawPath;

  // Onboarding — only requires cognitoSub, not existing tenant
  if (path === '/api/tenant/onboard' && method === 'POST') {
    const cognitoSub = extractCognitoSub(event);
    if (!cognitoSub) {
      return json({ statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) });
    }
    const onboardResult = await handleOnboard(cognitoSub, event.body ?? '', {
      generateSecret: () => randomBytes(32).toString('hex'),
      setWebhook,
      registerPayPalWebhook,
      telegramWebhookUrl: config.telegramWebhookUrl,
      stripeWebhookUrl: config.stripeWebhookUrl,
      paypalWebhookUrl: config.paypalWebhookUrl,
      paypalBaseUrl: config.paypalBaseUrl,
    });
    // Register sub→tenantId so JWT-authed requests resolve the tenant
    if (onboardResult.statusCode === 201) {
      const body = JSON.parse(onboardResult.body);
      if (body.tenantId) registerTenantForSub(cognitoSub, body.tenantId);
    }
    return json(onboardResult);
  }

  // All other routes require existing tenant
  const auth = await extractAuthContext(event);
  if (!auth) {
    return json({ statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) });
  }

  // Tenant routes
  if (path === '/api/tenant' && method === 'GET') {
    return json(await handleGetTenant(auth));
  }
  if (path === '/api/tenant' && method === 'PUT') {
    return json(await handleUpdateTenant(auth, event.body ?? ''));
  }
  if (path === '/api/tenant/payment' && method === 'PUT') {
    return json(
      await handleConfigurePayment(auth, event.body ?? '', {
        registerPayPalWebhook,
        stripeWebhookUrl: config.stripeWebhookUrl,
        paypalWebhookUrl: config.paypalWebhookUrl,
        paypalBaseUrl: config.paypalBaseUrl,
      }),
    );
  }

  // Room routes
  if (path === '/api/rooms' && method === 'GET') {
    return json(await handleListRooms(auth));
  }
  if (path === '/api/rooms' && method === 'POST') {
    return json(await handleCreateRoom(auth, event.body ?? ''));
  }

  // Room detail routes
  const roomMatch = path.match(/^\/api\/rooms\/([^/]+)$/);
  if (roomMatch) {
    const roomId = roomMatch[1];
    if (method === 'GET') {
      return json(await handleGetRoom(auth, roomId));
    }
    if (method === 'PUT') {
      return json(await handleUpdateRoom(auth, roomId, event.body ?? ''));
    }
  }

  // Subscriber routes
  const subMatch = path.match(/^\/api\/rooms\/([^/]+)\/subscribers$/);
  if (subMatch && method === 'GET') {
    return json(await handleListSubscribers(auth, subMatch[1]));
  }

  // Webhook registration
  if (path === '/api/tenant/register-webhook' && method === 'POST') {
    return json(await handleRegisterWebhook(auth, config.telegramWebhookUrl));
  }

  // Invite / user management
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  if (userPoolId) {
    if (path === '/api/admin/invite' && method === 'POST') {
      return json(await handleInviteUser(userPoolId, event.body ?? ''));
    }
    if (path === '/api/admin/users' && method === 'GET') {
      return json(await handleListUsers(userPoolId));
    }
  }

  return json({ statusCode: 404, body: JSON.stringify({ error: 'Not found' }) });
}
