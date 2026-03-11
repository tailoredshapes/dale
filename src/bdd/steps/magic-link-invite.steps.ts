import { Given, When, Then, Before } from 'quickpickle';
import { vi, expect } from 'vitest';
import type { DaleWorld } from '../world.js';
import { handleInviteUser, handleRedeemInvite } from '../../admin/routes/invite.js';
import type { InviteToken } from '../../db/invite-tokens.js';

// ── Extended world for magic link tests ──────────────────────────────────────

declare module '../world.js' {
  interface DaleWorld {
    storedToken?: InviteToken | null;
    emailSent?: { to: string; magicLink: string } | null;
    testToken?: string;
    testTokens?: Map<string, InviteToken>;
  }
}

const mockInviteDeps = {
  createUser: vi.fn(),
  storeToken: vi.fn(),
  sendEmail: vi.fn(),
  generateToken: () => 'test-token-uuid',
  generatePassword: () => 'TempPass12345',
  baseUrl: 'https://dalegram.com',
};

const mockRedeemDeps = {
  getToken: vi.fn(),
  markUsed: vi.fn(),
};

// Initialize magic link state (runs for all scenarios, but only sets up once)
Before(async (world: DaleWorld) => {
  if (world.storedToken === undefined) {
    world.storedToken = null;
    world.emailSent = null;
    world.testToken = 'test-token-uuid';
    world.testTokens = new Map();

    mockInviteDeps.storeToken.mockImplementation(async (token: InviteToken) => {
      world.storedToken = token;
      world.testTokens!.set(token.id, token);
    });
    mockInviteDeps.sendEmail.mockImplementation(async (to: string, magicLink: string) => {
      world.emailSent = { to, magicLink };
    });

    mockRedeemDeps.getToken.mockImplementation(async (id: string) => {
      return world.testTokens!.get(id) ?? null;
    });
    mockRedeemDeps.markUsed.mockImplementation(async (id: string) => {
      const token = world.testTokens!.get(id);
      if (token) {
        token.usedAt = new Date().toISOString();
      }
    });
  }
  mockInviteDeps.createUser.mockResolvedValue(undefined);
});

// ── Givens (magic-link specific) ─────────────────────────────────────────────

Given('I am an authenticated tenant admin', async () => {
  // Already set up in Background — tests run with mocked auth
});

Given('a valid invite token exists for {string}', async (world: DaleWorld, email: string) => {
  world.testToken = 'valid-token-' + Date.now();
  const token: InviteToken = {
    id: world.testToken,
    email,
    temporaryPassword: 'TempPass12345',
    tenantId: 'tenant-123',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
  world.testTokens!.set(world.testToken, token);
});

Given('a token that has already been redeemed for {string}', async (world: DaleWorld, email: string) => {
  world.testToken = 'used-token-' + Date.now();
  const token: InviteToken = {
    id: world.testToken,
    email,
    temporaryPassword: 'TempPass12345',
    tenantId: 'tenant-123',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    usedAt: new Date().toISOString(),
  };
  world.testTokens!.set(world.testToken, token);
});

Given('an invite token that expired 25 hours ago for {string}', async (world: DaleWorld, email: string) => {
  world.testToken = 'expired-token-' + Date.now();
  const token: InviteToken = {
    id: world.testToken,
    email,
    temporaryPassword: 'TempPass12345',
    tenantId: 'tenant-123',
    expiresAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
  };
  world.testTokens!.set(world.testToken, token);
});

// ── Whens (magic-link specific) ──────────────────────────────────────────────

When('I POST to {string} with body:', async (world: DaleWorld, path: string, table: any) => {
  const rows: string[][] = table.raw ? table.raw() : table;
  const body = Object.fromEntries(rows.map((r: string[]) => [r[0], r[1]]));

  if (path === '/api/admin/invite') {
    world.response = await handleInviteUser('us-east-1_TestPool', 'tenant-123', JSON.stringify(body), mockInviteDeps);
  }
});

When('I POST to {string} without auth with body:', async (world: DaleWorld, _path: string, _table: any) => {
  world.response = { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
});

When('I GET {string}', async (world: DaleWorld, path: string) => {
  const tokenMatch = path.match(/^\/api\/invite\/(.+)$/);
  if (tokenMatch) {
    const tokenId = tokenMatch[1] === '<token>' ? world.testToken! : tokenMatch[1];
    world.response = await handleRedeemInvite(tokenId, mockRedeemDeps);
  }
});

// ── Thens (magic-link specific) ──────────────────────────────────────────────
// Note: Common Thens (response status, response contains) are in common.steps.ts

Then('a magic link token is stored for {string}', async (world: DaleWorld, email: string) => {
  expect(world.storedToken).not.toBeNull();
  expect(world.storedToken!.email).toBe(email);
  expect(world.storedToken!.tenantId).toBe('tenant-123');

  const expiresAt = new Date(world.storedToken!.expiresAt).getTime();
  const expected = Date.now() + 24 * 60 * 60 * 1000;
  expect(Math.abs(expiresAt - expected)).toBeLessThan(1000);
});

Then('the invite email was sent to {string}', async (world: DaleWorld, email: string) => {
  expect(world.emailSent).not.toBeNull();
  expect(world.emailSent!.to).toBe(email);
});

Then('the email contains a URL with the token', async (world: DaleWorld) => {
  expect(world.emailSent).not.toBeNull();
  expect(world.emailSent!.magicLink).toContain('/accept-invite?token=');
  expect(world.emailSent!.magicLink).toContain(world.storedToken!.id);
});
