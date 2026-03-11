import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { handleInviteUser, handleListUsers, handleRedeemInvite } from '../routes/invite.js';
import type { InviteToken } from '../../db/invite-tokens.js';

const cognitoMock = mockClient(CognitoIdentityProviderClient);
const POOL_ID = 'us-east-1_TestPool';
const TENANT_ID = 'tenant-123';

beforeEach(() => {
  cognitoMock.reset();
  vi.clearAllMocks();
});

describe('handleInviteUser', () => {
  const mockDeps = {
    createUser: vi.fn(),
    storeToken: vi.fn(),
    sendEmail: vi.fn(),
    generateToken: () => 'test-token-uuid',
    generatePassword: () => 'TempPass12345',
    baseUrl: 'https://dalegram.com',
  };

  beforeEach(() => {
    mockDeps.createUser.mockResolvedValue(undefined);
    mockDeps.storeToken.mockResolvedValue(undefined);
    mockDeps.sendEmail.mockResolvedValue(undefined);
  });

  it('invites a valid email and returns 201 with invited: true', async () => {
    const result = await handleInviteUser(POOL_ID, TENANT_ID, JSON.stringify({ email: 'new@example.com' }), mockDeps);

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.invited).toBe(true);
    expect(body.email).toBe('new@example.com');
  });

  it('stores a magic link token for the invited email', async () => {
    await handleInviteUser(POOL_ID, TENANT_ID, JSON.stringify({ email: 'new@example.com' }), mockDeps);

    expect(mockDeps.storeToken).toHaveBeenCalledTimes(1);
    const storedToken = mockDeps.storeToken.mock.calls[0][0] as InviteToken;
    expect(storedToken.email).toBe('new@example.com');
    expect(storedToken.tenantId).toBe(TENANT_ID);
    expect(storedToken.id).toBe('test-token-uuid');
    expect(storedToken.temporaryPassword).toBe('TempPass12345');

    // Check 24h expiry (within 1 second tolerance)
    const expiresAt = new Date(storedToken.expiresAt).getTime();
    const expected = Date.now() + 24 * 60 * 60 * 1000;
    expect(Math.abs(expiresAt - expected)).toBeLessThan(1000);
  });

  it('sends an invite email with the magic link URL containing the token', async () => {
    await handleInviteUser(POOL_ID, TENANT_ID, JSON.stringify({ email: 'new@example.com' }), mockDeps);

    expect(mockDeps.sendEmail).toHaveBeenCalledTimes(1);
    expect(mockDeps.sendEmail).toHaveBeenCalledWith(
      'new@example.com',
      'https://dalegram.com/accept-invite?token=test-token-uuid',
    );
  });

  it('creates Cognito user with MessageAction SUPPRESS (no Cognito email)', async () => {
    await handleInviteUser(POOL_ID, TENANT_ID, JSON.stringify({ email: 'new@example.com' }), mockDeps);

    expect(mockDeps.createUser).toHaveBeenCalledWith(
      POOL_ID,
      'new@example.com',
      'TempPass12345',
    );
  });

  it('returns 400 for missing email', async () => {
    const result = await handleInviteUser(POOL_ID, TENANT_ID, JSON.stringify({}), mockDeps);
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe('Valid email is required');
  });

  it('returns 400 for invalid email', async () => {
    const result = await handleInviteUser(POOL_ID, TENANT_ID, JSON.stringify({ email: 'not-an-email' }), mockDeps);
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe('Valid email is required');
  });

  it('returns 400 for invalid JSON', async () => {
    const result = await handleInviteUser(POOL_ID, TENANT_ID, 'not-json', mockDeps);
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe('Invalid JSON');
  });
});

describe('handleRedeemInvite', () => {
  const mockDeps = {
    getToken: vi.fn(),
    markUsed: vi.fn(),
  };

  beforeEach(() => {
    mockDeps.getToken.mockReset();
    mockDeps.markUsed.mockReset();
  });

  it('returns 200 with email and temporaryPassword for valid token', async () => {
    const token: InviteToken = {
      id: 'valid-token',
      email: 'new@example.com',
      temporaryPassword: 'TempPass12345',
      tenantId: TENANT_ID,
      expiresAt: new Date(Date.now() + 60000).toISOString(), // expires in 1 minute
    };
    mockDeps.getToken.mockResolvedValue(token);
    mockDeps.markUsed.mockResolvedValue(undefined);

    const result = await handleRedeemInvite('valid-token', mockDeps);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.email).toBe('new@example.com');
    expect(body.temporaryPassword).toBe('TempPass12345');
  });

  it('marks the token as used after successful redemption', async () => {
    const token: InviteToken = {
      id: 'valid-token',
      email: 'new@example.com',
      temporaryPassword: 'TempPass12345',
      tenantId: TENANT_ID,
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    };
    mockDeps.getToken.mockResolvedValue(token);
    mockDeps.markUsed.mockResolvedValue(undefined);

    await handleRedeemInvite('valid-token', mockDeps);

    expect(mockDeps.markUsed).toHaveBeenCalledWith('valid-token');
  });

  it('returns 410 for already used token', async () => {
    const token: InviteToken = {
      id: 'used-token',
      email: 'used@example.com',
      temporaryPassword: 'TempPass12345',
      tenantId: TENANT_ID,
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      usedAt: new Date().toISOString(), // already used
    };
    mockDeps.getToken.mockResolvedValue(token);

    const result = await handleRedeemInvite('used-token', mockDeps);

    expect(result.statusCode).toBe(410);
    expect(mockDeps.markUsed).not.toHaveBeenCalled();
  });

  it('returns 410 for expired token', async () => {
    const token: InviteToken = {
      id: 'expired-token',
      email: 'expired@example.com',
      temporaryPassword: 'TempPass12345',
      tenantId: TENANT_ID,
      expiresAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // expired 25 hours ago
    };
    mockDeps.getToken.mockResolvedValue(token);

    const result = await handleRedeemInvite('expired-token', mockDeps);

    expect(result.statusCode).toBe(410);
    expect(mockDeps.markUsed).not.toHaveBeenCalled();
  });

  it('returns 404 for non-existent token', async () => {
    mockDeps.getToken.mockResolvedValue(null);

    const result = await handleRedeemInvite('not-a-real-token', mockDeps);

    expect(result.statusCode).toBe(404);
  });
});

describe('handleListUsers', () => {
  it('returns list of users', async () => {
    cognitoMock.on(ListUsersCommand).resolves({
      Users: [
        {
          Username: 'user1',
          Attributes: [{ Name: 'email', Value: 'a@b.com' }],
          UserStatus: 'CONFIRMED',
          UserCreateDate: new Date('2025-01-01'),
        },
        {
          Username: 'user2',
          Attributes: [{ Name: 'email', Value: 'c@d.com' }],
          UserStatus: 'FORCE_CHANGE_PASSWORD',
          UserCreateDate: new Date('2025-06-15'),
        },
      ],
    });

    const result = await handleListUsers(POOL_ID);
    expect(result.statusCode).toBe(200);
    const users = JSON.parse(result.body);
    expect(users).toHaveLength(2);
    expect(users[0].email).toBe('a@b.com');
    expect(users[0].status).toBe('CONFIRMED');
    expect(users[1].email).toBe('c@d.com');
    expect(users[1].status).toBe('FORCE_CHANGE_PASSWORD');
  });

  it('returns empty list when no users', async () => {
    cognitoMock.on(ListUsersCommand).resolves({ Users: [] });

    const result = await handleListUsers(POOL_ID);
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual([]);
  });
});
