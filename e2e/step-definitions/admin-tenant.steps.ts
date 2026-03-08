import { When, Given } from '@cucumber/cucumber';
import { DaleWorld } from '../support/world.js';
import { apiRequest } from '../support/http.js';
import { cacheTenantSecrets } from '../support/ssm.js';
import assert from 'node:assert/strict';

// Test Stripe credentials for E2E tests
const TEST_STRIPE_SECRET_KEY = 'sk_test_e2e_fake';
const TEST_STRIPE_WEBHOOK_SECRET = 'whsec_e2e_fake';

// Test PayPal credentials for E2E tests
const TEST_PAYPAL_CLIENT_ID = 'pp_test_client_id_e2e';
const TEST_PAYPAL_CLIENT_SECRET = 'pp_test_client_secret_e2e';

When<DaleWorld>('I onboard a new tenant with display name {string}', async function (displayName: string) {
  assert.ok(this.idToken, 'No auth token available');
  this.lastResponse = await apiRequest(`${this.config.adminApiUrl}/api/tenant/onboard`, 'POST', {
    token: this.idToken,
    body: {
      displayName,
      telegramBotToken: '000000000:fake-bot-token-for-e2e',
      stripeSecretKey: TEST_STRIPE_SECRET_KEY,
      stripeWebhookSecret: TEST_STRIPE_WEBHOOK_SECRET,
      paypalClientId: TEST_PAYPAL_CLIENT_ID,
      paypalClientSecret: TEST_PAYPAL_CLIENT_SECRET,
    },
  });

  if (this.lastResponse.status === 201 && this.lastResponse.body?.tenantId) {
    const { tenantId, webhookSecret, stripeWebhookSecret } = this.lastResponse.body;
    this.tenantIds.push(tenantId);
    // Cache secrets for later retrieval via getSSMParameter
    if (webhookSecret) {
      cacheTenantSecrets(tenantId, { webhookSecret, stripeWebhookSecret });
      this.webhookSecrets.push(webhookSecret);
    }
  }
});

Given<DaleWorld>('I have onboarded a tenant with display name {string}', async function (displayName: string) {
  assert.ok(this.idToken, 'No auth token available');
  const response = await apiRequest(`${this.config.adminApiUrl}/api/tenant/onboard`, 'POST', {
    token: this.idToken,
    body: {
      displayName,
      telegramBotToken: '000000000:fake-bot-token-for-e2e',
      stripeSecretKey: TEST_STRIPE_SECRET_KEY,
      stripeWebhookSecret: TEST_STRIPE_WEBHOOK_SECRET,
      paypalClientId: TEST_PAYPAL_CLIENT_ID,
      paypalClientSecret: TEST_PAYPAL_CLIENT_SECRET,
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
});

When<DaleWorld>(
  'I send an authenticated PUT request to {string} with body:',
  async function (path: string, body: string) {
    assert.ok(this.idToken, 'No auth token available');
    this.lastResponse = await apiRequest(`${this.config.adminApiUrl}${path}`, 'PUT', {
      token: this.idToken,
      body: JSON.parse(body),
    });
  },
);

When<DaleWorld>(
  'I send a POST request to {string} without auth with body:',
  async function (path: string, body: string) {
    this.lastResponse = await apiRequest(`${this.config.adminApiUrl}${path}`, 'POST', {
      body: JSON.parse(body),
    });
  },
);
