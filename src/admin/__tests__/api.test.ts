import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

vi.mock('../middleware/auth.js', () => ({
  extractAuthContext: vi.fn(),
  extractCognitoSub: vi.fn(),
}));

vi.mock('../routes/tenant.js', () => ({
  handleGetTenant: vi.fn().mockResolvedValue({ statusCode: 200, body: '{}' }),
  handleUpdateTenant: vi.fn().mockResolvedValue({ statusCode: 200, body: '{}' }),
  handleOnboard: vi.fn().mockResolvedValue({ statusCode: 201, body: '{}' }),
}));

vi.mock('../routes/rooms.js', () => ({
  handleListRooms: vi.fn().mockResolvedValue({ statusCode: 200, body: '[]' }),
  handleGetRoom: vi.fn().mockResolvedValue({ statusCode: 200, body: '{}' }),
  handleCreateRoom: vi.fn().mockResolvedValue({ statusCode: 201, body: '{}' }),
  handleUpdateRoom: vi.fn().mockResolvedValue({ statusCode: 200, body: '{}' }),
}));

vi.mock('../routes/subscribers.js', () => ({
  handleListSubscribers: vi.fn().mockResolvedValue({ statusCode: 200, body: '[]' }),
}));

vi.mock('../routes/webhooks.js', () => ({
  handleRegisterWebhook: vi.fn().mockResolvedValue({ statusCode: 200, body: '{}' }),
}));

vi.mock('../routes/invite.js', () => ({
  handleInviteUser: vi.fn().mockResolvedValue({ statusCode: 201, body: '{"email":"a@b.com","invited":true}' }),
  handleListUsers: vi.fn().mockResolvedValue({ statusCode: 200, body: '[]' }),
}));

vi.mock('../../db/webhook-secrets.js', () => ({
  createWebhookSecretMapping: vi.fn(),
}));

vi.mock('../../telegram/api.js', () => ({
  setWebhook: vi.fn(),
}));

vi.mock('ulid', () => ({
  ulid: vi.fn().mockReturnValue('01TEST'),
}));

import { handler } from '../api.js';
import { extractAuthContext, extractCognitoSub } from '../middleware/auth.js';

const mockedAuth = vi.mocked(extractAuthContext);
const mockedCognitoSub = vi.mocked(extractCognitoSub);

function makeEvent(method: string, path: string, body?: string): APIGatewayProxyEventV2 {
  return {
    requestContext: {
      http: { method },
      authorizer: { jwt: { claims: { sub: 'user-123' } } },
    },
    rawPath: path,
    headers: {},
    queryStringParameters: {},
    body: body ?? null,
  } as unknown as APIGatewayProxyEventV2;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedAuth.mockResolvedValue({ cognitoSub: 'user-123', tenantId: 'tenant-1' });
  mockedCognitoSub.mockReturnValue('user-123');
});

describe('Admin API handler', () => {
  it('handles OPTIONS for CORS', async () => {
    const result = await handler(makeEvent('OPTIONS', '/api/tenant')) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(200);
    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
  });

  it('routes GET /api/tenant', async () => {
    const result = await handler(makeEvent('GET', '/api/tenant')) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(200);
  });

  it('routes PUT /api/tenant', async () => {
    const result = await handler(makeEvent('PUT', '/api/tenant', '{}')) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(200);
  });

  it('routes GET /api/rooms', async () => {
    const result = await handler(makeEvent('GET', '/api/rooms')) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(200);
  });

  it('routes POST /api/rooms', async () => {
    const result = await handler(makeEvent('POST', '/api/rooms', '{}')) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(201);
  });

  it('routes GET /api/rooms/:id', async () => {
    const result = await handler(makeEvent('GET', '/api/rooms/r1')) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(200);
  });

  it('routes GET /api/rooms/:id/subscribers', async () => {
    const result = await handler(makeEvent('GET', '/api/rooms/r1/subscribers')) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(200);
  });

  it('returns 401 for unauthorized requests', async () => {
    mockedAuth.mockResolvedValue(null);
    const result = await handler(makeEvent('GET', '/api/tenant')) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(401);
  });

  it('routes POST /api/admin/invite', async () => {
    const result = await handler(makeEvent('POST', '/api/admin/invite', '{"email":"a@b.com"}')) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(201);
  });

  it('routes GET /api/admin/users', async () => {
    const result = await handler(makeEvent('GET', '/api/admin/users')) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(200);
  });

  it('returns 404 for unknown routes', async () => {
    const result = await handler(makeEvent('GET', '/api/unknown')) as APIGatewayProxyStructuredResultV2;
    expect(result.statusCode).toBe(404);
  });
});
