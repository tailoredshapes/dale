/**
 * Local development server that wraps Lambda handlers
 * Provides endpoints for Admin API, Telegram, Stripe, and PayPal webhooks
 */
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';

// Configure AWS SDK endpoints before importing handlers
process.env.AWS_ENDPOINT_URL_DYNAMODB = process.env.DYNAMODB_ENDPOINT;
process.env.AWS_ENDPOINT_URL_SSM = process.env.SSM_ENDPOINT;

// Import handlers dynamically after setting env vars
const { handler: adminHandler } = await import('../src/admin/api.js');
const { handler: telegramHandler } = await import('../src/telegram/webhook.js');
const { handler: stripeHandler } = await import('../src/stripe/webhook.js');
const { handler: paypalHandler } = await import('../src/paypal/webhook.js');
const { signToken, verifyToken } = await import('./mock-auth.js');

// Helper to read request body
async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

// Convert Node.js request to API Gateway event
function toApiGatewayEvent(
  req: IncomingMessage,
  body: string,
  pathOverride?: string,
): APIGatewayProxyEventV2 {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const queryParams: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    queryParams[key] = value;
  });

  // Extract JWT claims from Authorization header for mock Cognito
  let claims: Record<string, string> = {};
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = verifyToken(token);
    if (payload) {
      claims = {
        sub: payload.sub,
        email: payload.email,
      };
    }
  }

  return {
    version: '2.0',
    routeKey: `${req.method} ${pathOverride || url.pathname}`,
    rawPath: pathOverride || url.pathname,
    rawQueryString: url.search.substring(1),
    headers: Object.fromEntries(
      Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v || '']),
    ),
    queryStringParameters: Object.keys(queryParams).length > 0 ? queryParams : undefined,
    body,
    isBase64Encoded: false,
    requestContext: {
      accountId: '123456789012',
      apiId: 'local',
      authorizer: {
        jwt: {
          claims,
          scopes: [],
        },
      },
      domainName: 'localhost',
      domainPrefix: 'localhost',
      http: {
        method: req.method || 'GET',
        path: pathOverride || url.pathname,
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: req.headers['user-agent'] || '',
      },
      requestId: `local-${Date.now()}`,
      routeKey: `${req.method} ${pathOverride || url.pathname}`,
      stage: '$default',
      time: new Date().toISOString(),
      timeEpoch: Date.now(),
    },
  };
}

// Send response back to client
function sendResponse(res: ServerResponse, result: APIGatewayProxyResultV2): void {
  const statusCode = typeof result === 'object' && 'statusCode' in result ? result.statusCode : 200;
  const headers = typeof result === 'object' && 'headers' in result ? result.headers : {};
  const body = typeof result === 'object' && 'body' in result ? result.body : String(result);

  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Telegram-Bot-Api-Secret-Token,Stripe-Signature',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    ...headers,
  });
  res.end(body);
}

// Create server for a specific handler
function createHandlerServer(
  port: number,
  name: string,
  handler: (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyResultV2>,
): void {
  const server = createServer(async (req, res) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      sendResponse(res, { statusCode: 200, body: '' });
      return;
    }

    try {
      const body = await readBody(req);
      const event = toApiGatewayEvent(req, body);
      const result = await handler(event);
      sendResponse(res, result);
    } catch (error) {
      console.error(`[${name}] Error:`, error);
      sendResponse(res, { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) });
    }
  });

  server.listen(port, () => {
    console.log(`[${name}] listening on http://localhost:${port}`);
  });
}

// Admin API server with auth endpoints
const adminServer = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    sendResponse(res, { statusCode: 200, body: '' });
    return;
  }

  // Health check endpoint
  if (url.pathname === '/health') {
    sendResponse(res, { statusCode: 200, body: JSON.stringify({ status: 'ok' }) });
    return;
  }

  // Mock auth endpoints
  if (url.pathname === '/auth/token' && req.method === 'POST') {
    const body = await readBody(req);
    const { email, password } = JSON.parse(body || '{}');
    if (!email) {
      sendResponse(res, { statusCode: 400, body: JSON.stringify({ error: 'Email required' }) });
      return;
    }
    // In local mode, any password works - just issue a token
    const token = signToken({ sub: `local-${email}`, email });
    sendResponse(res, {
      statusCode: 200,
      body: JSON.stringify({
        idToken: token,
        accessToken: token,
        refreshToken: 'mock-refresh-token',
      }),
    });
    return;
  }

  if (url.pathname === '/auth/register' && req.method === 'POST') {
    const body = await readBody(req);
    const { email } = JSON.parse(body || '{}');
    if (!email) {
      sendResponse(res, { statusCode: 400, body: JSON.stringify({ error: 'Email required' }) });
      return;
    }
    // In local mode, registration always succeeds
    const token = signToken({ sub: `local-${email}`, email });
    sendResponse(res, {
      statusCode: 201,
      body: JSON.stringify({
        idToken: token,
        accessToken: token,
        refreshToken: 'mock-refresh-token',
        username: email,
      }),
    });
    return;
  }

  // Forward to admin handler
  try {
    const body = await readBody(req);
    const event = toApiGatewayEvent(req, body);
    const result = await adminHandler(event);
    sendResponse(res, result);
  } catch (error) {
    console.error('[Admin] Error:', error);
    sendResponse(res, { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) });
  }
});

adminServer.listen(3000, () => {
  console.log('[Admin API] listening on http://localhost:3000');
});

// Create webhook servers
createHandlerServer(3001, 'Telegram', telegramHandler);
createHandlerServer(3002, 'Stripe', stripeHandler);
createHandlerServer(3003, 'PayPal', paypalHandler);

// Mock Telegram API server for local development
const telegramMockServer = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const body = await readBody(req);

  // Mock all Telegram Bot API methods with success responses
  const method = url.pathname.split('/').pop() || '';

  let response: Record<string, unknown> = { ok: true };

  if (method === 'setWebhook') {
    response = { ok: true, result: true, description: 'Webhook was set' };
  } else if (method === 'sendMessage') {
    response = { ok: true, result: { message_id: Date.now() } };
  } else if (method === 'createChatInviteLink') {
    response = { ok: true, result: { invite_link: 'https://t.me/+mock_invite_link' } };
  } else if (method === 'banChatMember' || method === 'unbanChatMember') {
    response = { ok: true, result: true };
  }

  console.log(`[Telegram Mock] ${method}: ${body.substring(0, 100)}`);

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(response));
});

telegramMockServer.listen(3004, () => {
  console.log('[Telegram Mock API] listening on http://localhost:3004');
});

console.log('\nLocal Dale server is running!');
console.log('  Admin API:        http://localhost:3000');
console.log('  Telegram webhook: http://localhost:3001');
console.log('  Stripe webhook:   http://localhost:3002');
console.log('  PayPal webhook:   http://localhost:3003');
console.log('  Telegram Mock:    http://localhost:3004');
console.log('\nAuth endpoints:');
console.log('  POST /auth/register - Create user and get token');
console.log('  POST /auth/token    - Get token for existing user');
