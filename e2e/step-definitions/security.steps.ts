/**
 * Step definitions for security scenarios
 */
import { Given, When, Then, DataTable } from '@cucumber/cucumber';
import { DaleWorld } from '../support/world.js';
import { apiRequest } from '../support/http.js';
import { cacheTenantSecrets } from '../support/ssm.js';
import { createLocalTestUser } from '../support/local-auth.js';
import assert from 'node:assert/strict';

// ============== Helper Functions ==============

/**
 * Create a tampered JWT token
 * This modifies the payload without re-signing, causing verification to fail
 */
function createTamperedToken(originalToken: string): string {
  const parts = originalToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }

  // Decode the payload
  const payloadBase64 = parts[1];
  const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8'));

  // Tamper with the payload
  payload.sub = 'tampered-user-id';
  payload.email = 'tampered@evil.com';

  // Re-encode (but don't re-sign - this will fail verification)
  const tamperedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');

  return `${parts[0]}.${tamperedPayload}.${parts[2]}`;
}

/**
 * Create an "expired" token
 * For local mode, we create a token that appears expired
 */
function createExpiredToken(): string {
  // Create a JWT-like structure with exp in the past
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'expired-user',
      email: 'expired@test.com',
      exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
    }),
  ).toString('base64url');
  const signature = 'invalid-signature';

  return `${header}.${payload}.${signature}`;
}

// ============== Given Steps ==============

// Test Stripe credentials for E2E tests
const TEST_STRIPE_SECRET_KEY = 'sk_test_e2e_fake';
const TEST_STRIPE_WEBHOOK_SECRET = 'whsec_e2e_fake';

Given<DaleWorld>(
  'I have onboarding a tenant with display name {string}',
  async function (displayName: string) {
    // Note: This step has a typo in the feature file ("onboarding" instead of "onboarded")
    // We implement it as an alias to the standard onboard step
    assert.ok(this.idToken, 'No auth token available');
    const response = await apiRequest(`${this.config.adminApiUrl}/api/tenant/onboard`, 'POST', {
      token: this.idToken,
      body: {
        displayName,
        telegramBotToken: '000000000:fake-bot-token-for-e2e',
        stripeSecretKey: TEST_STRIPE_SECRET_KEY,
        stripeWebhookSecret: TEST_STRIPE_WEBHOOK_SECRET,
      },
    });

    assert.equal(response.status, 201, `Onboard failed: ${JSON.stringify(response.body)}`);
    const { tenantId, webhookSecret, stripeWebhookSecret } = response.body;
    this.tenantIds.push(tenantId);
    // Cache secrets for later retrieval via getSSMParameter
    if (webhookSecret) {
      cacheTenantSecrets(tenantId, { webhookSecret, stripeWebhookSecret });
      this.webhookSecrets.push(webhookSecret);
    }
  },
);

// ============== When Steps ==============

When<DaleWorld>(
  'I send a GET request to {string} with an expired token',
  async function (path: string) {
    const expiredToken = createExpiredToken();

    this.lastResponse = await apiRequest(
      `${this.config.adminApiUrl}${path}`,
      'GET',
      { token: expiredToken },
    );
  },
);

When<DaleWorld>(
  'I send a GET request to {string} with a tampered JWT',
  async function (path: string) {
    // First get a valid token
    const user = await createLocalTestUser(this.config.adminApiUrl);

    // Tamper with it
    const tamperedToken = createTamperedToken(user.idToken);

    this.lastResponse = await apiRequest(
      `${this.config.adminApiUrl}${path}`,
      'GET',
      { token: tamperedToken },
    );
  },
);

When<DaleWorld>(
  'I send a POST to the Telegram webhook without a secret header',
  async function () {
    // Use a valid tenant ID to test secret validation specifically
    const tenantId = this.tenantIds.length > 0 ? this.tenantIds[0] : 'test-tenant';
    const response = await fetch(`${this.config.telegramWebhookUrl}?tenant=${tenantId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ update_id: 1 }),
    });

    this.lastResponse = {
      status: response.status,
      body: await response.text(),
      headers: response.headers,
    };
  },
);
When<DaleWorld>(
  'I send a POST to the Stripe webhook with tenant {string} and no signature',
  async function (tenant: string) {
    const url = `${this.config.stripeWebhookUrl}?tenant=${tenant}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // No stripe-signature header
      },
      body: JSON.stringify({ type: 'test.event' }),
    });

    this.lastResponse = {
      status: response.status,
      body: await response.text(),
      headers: response.headers,
    };
  },
);

When<DaleWorld>(
  'I send a POST to the PayPal webhook with garbage body',
  async function () {
    const response = await fetch(this.config.paypalWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: 'not valid json {{{',
    });

    this.lastResponse = {
      status: response.status,
      body: await response.text(),
      headers: response.headers,
    };
  },
);

When<DaleWorld>(
  "Tenant B requests Tenant A's room by ID",
  async function () {
    assert.ok(this.secondTenantToken, 'No second tenant token available');
    assert.ok(this.lastRoomId, 'No room ID available');

    this.lastResponse = await apiRequest(
      `${this.config.adminApiUrl}/api/rooms/${this.lastRoomId}`,
      'GET',
      { token: this.secondTenantToken },
    );
  },
);

When<DaleWorld>(
  "Tenant B sends a PUT to Tenant A's room with body:",
  async function (body: string) {
    assert.ok(this.secondTenantToken, 'No second tenant token available');
    assert.ok(this.lastRoomId, 'No room ID available');

    this.lastResponse = await apiRequest(
      `${this.config.adminApiUrl}/api/rooms/${this.lastRoomId}`,
      'PUT',
      {
        token: this.secondTenantToken,
        body: JSON.parse(body),
      },
    );
  },
);

When<DaleWorld>(
  'I create a room with a name of 500 characters',
  async function () {
    assert.ok(this.idToken, 'No auth token available');

    const longName = 'A'.repeat(500);

    this.lastResponse = await apiRequest(
      `${this.config.adminApiUrl}/api/rooms`,
      'POST',
      {
        token: this.idToken,
        body: {
          name: longName,
          description: 'Test room with very long name',
        },
      },
    );

    // Track room for cleanup
    if (this.lastResponse.status === 201 && this.lastResponse.body?.roomId) {
      this.lastRoomId = this.lastResponse.body.roomId;
    }
  },
);

// Note: "the response status should be {int} or {int}" is defined in common.steps.ts
