import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getPlatformConfig } from '../shared/config.js';
import { extractAuthContext, extractCognitoSub, registerTenantForSub } from './middleware/auth.js';
import { handleGetTenant, handleUpdateTenant, handleOnboard, handleConfigurePayment, handleConfigureTelegram } from './routes/tenant.js';
import { handleListRooms, handleGetRoom, handleCreateRoom, handleUpdateRoom, handleDeleteRoom } from './routes/rooms.js';
import { handleListSubscribers } from './routes/subscribers.js';
import { handleRegisterWebhook } from './routes/webhooks.js';
import { handleInviteUser, handleListUsers, handleRedeemInvite, createCognitoUser } from './routes/invite.js';
import { createInviteToken, getInviteToken, markTokenUsed } from '../db/invite-tokens.js';
import { setWebhook } from '../telegram/api.js';
import { registerPayPalWebhook } from '../paypal/client.js';
import { randomBytes, randomUUID } from 'crypto';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const ses = new SESClient({ region: process.env.AWS_REGION ?? 'us-east-1' });

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

async function sendInviteEmail(to: string, magicLink: string): Promise<void> {
  const sourceEmail = process.env.SES_FROM_EMAIL ?? 'noreply@dalegram.com';
  await ses.send(
    new SendEmailCommand({
      Source: sourceEmail,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: 'You\'ve been invited to Dale' },
        Body: {
          Html: {
            Data: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px;">
  <h1 style="color: #333;">Welcome to Dale!</h1>
  <p style="font-size: 16px; color: #555;">You've been invited to join Dale. Click the button below to sign in:</p>
  <a href="${magicLink}" style="display: inline-block; padding: 16px 32px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 8px; font-size: 18px; margin: 20px 0;">
    Sign In to Dale
  </a>
  <p style="font-size: 14px; color: #888;">This link expires in 24 hours.</p>
  <p style="font-size: 12px; color: #aaa;">If the button doesn't work, copy and paste this URL: ${magicLink}</p>
</body>
</html>`,
          },
          Text: { Data: `You've been invited to Dale. Sign in here: ${magicLink}\n\nThis link expires in 24 hours.` },
        },
      },
    }),
  );
}

function generatePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  const bytes = randomBytes(12);
  for (let i = 0; i < 12; i++) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
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

  // GET /api/invite/:token (public — no auth required)
  const inviteTokenMatch = path.match(/^\/api\/invite\/([^/]+)$/);
  if (inviteTokenMatch && method === 'GET') {
    return json(await handleRedeemInvite(inviteTokenMatch[1], {
      getToken: getInviteToken,
      markUsed: markTokenUsed,
    }));
  }

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
    // Check if user is authenticated but just hasn't onboarded
    const cognitoSub = extractCognitoSub(event);
    if (cognitoSub) {
      // User is authenticated but has no tenant - must onboard first
      return json({ statusCode: 404, body: JSON.stringify({ error: 'Tenant not found. Please onboard first.' }) });
    }
    // Not authenticated at all
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
  if (path === '/api/tenant/telegram' && method === 'PUT') {
    return json(
      await handleConfigureTelegram(auth, event.body ?? '', {
        setWebhook,
        telegramWebhookUrl: config.telegramWebhookUrl,
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
    if (method === 'DELETE') {
      return json(await handleDeleteRoom(auth, roomId));
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
      return json(await handleInviteUser(userPoolId, auth.tenantId, event.body ?? '', {
        createUser: createCognitoUser,
        storeToken: async (token) => { await createInviteToken(token); },
        sendEmail: sendInviteEmail,
        generateToken: randomUUID,
        generatePassword,
        baseUrl: config.webAppUrl,
      }));
    }
    if (path === '/api/admin/users' && method === 'GET') {
      return json(await handleListUsers(userPoolId));
    }
  }

  return json({ statusCode: 404, body: JSON.stringify({ error: 'Not found' }) });
}
