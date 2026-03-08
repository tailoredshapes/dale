/**
 * Step definitions for multi-tenant isolation scenarios
 */
import { Given, When, Then } from '@cucumber/cucumber';
import { DaleWorld } from '../support/world.js';
import { apiRequest } from '../support/http.js';
import { cacheTenantSecrets, getSSMParameter } from '../support/ssm.js';
import {
  sendStripeWebhook,
  getStripeWebhookSecret,
  buildCheckoutCompletedEvent,
  buildSubscriptionDeletedEvent,
} from '../support/stripe.js';
import { sendTelegramWebhook, buildMessage } from '../support/telegram.js';
import { createLocalTestUser } from '../support/local-auth.js';
import assert from 'node:assert/strict';

// ============== Given Steps ==============

Given<DaleWorld>(
  'I have onboarded a second tenant with display name {string}',
  async function (displayName: string) {
    // Create a new user for the second tenant
    const user = await createLocalTestUser(this.config.adminApiUrl);

    // Onboard the second tenant with this new user
    const response = await apiRequest(
      `${this.config.adminApiUrl}/api/tenant/onboard`,
      'POST',
      {
        token: user.idToken,
        body: {
          displayName,
          telegramBotToken: '111111111:second-tenant-bot-token-for-e2e',
        },
      },
    );

    assert.equal(response.status, 201, `Second tenant onboard failed: ${JSON.stringify(response.body)}`);

    // Store second tenant info
    const { tenantId, webhookSecret, stripeWebhookSecret } = response.body;
    this.secondTenantId = tenantId;
    this.secondTenantToken = user.idToken;
    this.tenantIds.push(tenantId);

    // Cache secrets and store webhook secret
    if (webhookSecret) {
      cacheTenantSecrets(tenantId, { webhookSecret, stripeWebhookSecret });
      this.secondTenantWebhookSecret = webhookSecret;
      this.webhookSecrets.push(webhookSecret);
    }
  },
);

Given<DaleWorld>(
  'a Stripe subscriber has been added to that room for user {int}',
  async function (userId: number) {
    assert.ok(this.tenantIds.length > 0, 'No tenant onboarded');
    assert.ok(this.lastRoomId, 'No room available');

    const tenantId = this.tenantIds[this.tenantIds.length - 1];
    const stripeSecret = await getStripeWebhookSecret(tenantId, this.config);

    const customerId = `cus_multi_${userId}_${Date.now()}`;
    const subscriptionId = `sub_multi_${userId}_${Date.now()}`;

    const event = buildCheckoutCompletedEvent(
      tenantId,
      userId,
      this.lastRoomId,
      customerId,
      subscriptionId,
    );

    await sendStripeWebhook(this.config.stripeWebhookUrl, tenantId, stripeSecret, event);
    await new Promise((r) => setTimeout(r, 500));

    this.stripeCustomerId = customerId;
    this.stripeSubscriptionId = subscriptionId;
  },
);

Given<DaleWorld>(
  'I have retrieved the webhook secret for Tenant A',
  async function () {
    assert.ok(this.tenantIds.length > 0, 'No tenant onboarded');
    const tenantId = this.tenantIds[0]; // First tenant is Tenant A
    const secret = await getSSMParameter(`/dale/tenants/${tenantId}/telegram-webhook-secret`, this.config);
    this.tenantAWebhookSecret = secret;
    this.webhookSecrets.push(secret);
  },
);

Given<DaleWorld>(
  'user {int} has an active subscription in that room under Tenant A',
  async function (userId: number) {
    assert.ok(this.tenantIds.length > 0, 'No tenant onboarded');
    assert.ok(this.lastRoomId, 'No room available');

    const tenantId = this.tenantIds[0]; // First tenant is Tenant A
    const stripeSecret = await getStripeWebhookSecret(tenantId, this.config);

    const customerId = `cus_ta_${userId}_${Date.now()}`;
    const subscriptionId = `sub_ta_${userId}_${Date.now()}`;

    const event = buildCheckoutCompletedEvent(
      tenantId,
      userId,
      this.lastRoomId,
      customerId,
      subscriptionId,
    );

    await sendStripeWebhook(this.config.stripeWebhookUrl, tenantId, stripeSecret, event);
    await new Promise((r) => setTimeout(r, 500));

    // Store Tenant A room
    this.tenantARoomId = this.lastRoomId;
    this.stripeCustomerId = customerId;
    this.stripeSubscriptionId = subscriptionId;
  },
);

Given<DaleWorld>(
  'I have created a room named {string} as Tenant Beta',
  async function (name: string) {
    assert.ok(this.secondTenantToken, 'No second tenant token available');

    const response = await apiRequest(`${this.config.adminApiUrl}/api/rooms`, 'POST', {
      token: this.secondTenantToken,
      body: {
        name,
        description: 'E2E test room for Tenant Beta',
        paymentLink: 'https://buy.stripe.com/tenant_beta',
        priceDescription: '$10/month',
      },
    });

    assert.equal(response.status, 201, `Create room as Tenant Beta failed: ${JSON.stringify(response.body)}`);
    this.tenantBRoomId = response.body.roomId;
  },
);

// ============== When Steps ==============

When<DaleWorld>('I list rooms as Tenant Beta', async function () {
  assert.ok(this.secondTenantToken, 'No second tenant token available');

  this.lastResponse = await apiRequest(
    `${this.config.adminApiUrl}/api/rooms`,
    'GET',
    { token: this.secondTenantToken },
  );
});

When<DaleWorld>('I list rooms as Tenant Alpha', async function () {
  assert.ok(this.idToken, 'No auth token available');

  this.lastResponse = await apiRequest(
    `${this.config.adminApiUrl}/api/rooms`,
    'GET',
    { token: this.idToken },
  );
});

When<DaleWorld>('I list all subscribers as Tenant Beta', async function () {
  assert.ok(this.secondTenantToken, 'No second tenant token available');

  // List all rooms for Tenant Beta first
  const roomsResponse = await apiRequest(
    `${this.config.adminApiUrl}/api/rooms`,
    'GET',
    { token: this.secondTenantToken },
  );

  // Store the response - Tenant Beta shouldn't see any rooms (or subscribers)
  this.lastResponse = roomsResponse;
});

When<DaleWorld>(
  "I send a Telegram update signed with Tenant A's secret to Tenant B's endpoint",
  async function () {
    assert.ok(this.tenantAWebhookSecret, 'No Tenant A webhook secret available');

    // Try to send a Telegram update with Tenant A's secret
    // This should fail because the secret doesn't match Tenant B
    const payload = buildMessage({
      chatId: 12345,
      chatType: 'private',
      text: '/start',
    });

    const result = await sendTelegramWebhook(
      this.config.telegramWebhookUrl,
      this.tenantAWebhookSecret, // Wrong secret for the endpoint
      payload,
    );

    this.lastResponse = {
      status: result.status,
      body: result.body,
      headers: new Headers(),
    };
  },
);

When<DaleWorld>(
  "Tenant B receives a Stripe subscription.deleted event for user {int}'s Stripe customer",
  async function (userId: number) {
    assert.ok(this.secondTenantId, 'No second tenant available');
    assert.ok(this.stripeCustomerId, 'No Stripe customer ID available');
    assert.ok(this.stripeSubscriptionId, 'No Stripe subscription ID available');

    // Get Tenant B's Stripe secret
    const stripeSecret = await getStripeWebhookSecret(this.secondTenantId, this.config);

    // Create event with Tenant A's customer data, send to Tenant B
    const event = buildSubscriptionDeletedEvent(
      this.stripeCustomerId,
      this.stripeSubscriptionId,
    );

    const result = await sendStripeWebhook(
      this.config.stripeWebhookUrl,
      this.secondTenantId,
      stripeSecret,
      event,
    );

    this.lastResponse = {
      status: result.status,
      body: result.body,
      headers: new Headers(),
    };

    await new Promise((r) => setTimeout(r, 500));
  },
);

When<DaleWorld>('I delete the room as Tenant Alpha', async function () {
  assert.ok(this.idToken, 'No auth token available');
  assert.ok(this.lastRoomId, 'No room to delete');

  // Store Tenant A's room ID before deletion
  this.tenantARoomId = this.lastRoomId;

  this.lastResponse = await apiRequest(
    `${this.config.adminApiUrl}/api/rooms/${this.lastRoomId}`,
    'DELETE',
    { token: this.idToken },
  );
});

// ============== Then Steps ==============

Then<DaleWorld>('no subscribers from Tenant Alpha are visible', async function () {
  assert.ok(this.lastResponse, 'No response recorded');

  // Tenant Beta should either see an empty rooms list or no subscribers
  if (this.lastResponse.status === 200 && Array.isArray(this.lastResponse.body)) {
    // If rooms were returned, none should have subscribers from Tenant Alpha
    assert.equal(this.lastResponse.body.length, 0, 'Tenant Beta should not see Tenant Alpha rooms');
  }
});

Then<DaleWorld>(
  "user {int}'s subscription under Tenant A should still be active",
  async function (userId: number) {
    assert.ok(this.idToken, 'No auth token available');
    assert.ok(this.tenantARoomId, 'No Tenant A room ID available');

    const response = await apiRequest(
      `${this.config.adminApiUrl}/api/rooms/${this.tenantARoomId}/subscribers`,
      'GET',
      { token: this.idToken },
    );

    assert.equal(response.status, 200, `Failed to get subscribers: ${JSON.stringify(response.body)}`);
    assert.ok(Array.isArray(response.body), 'Expected subscribers array');

    const subscriber = response.body.find((s: any) => s.telegramUserId === userId);
    assert.ok(subscriber, `User ${userId} not found in Tenant A subscribers`);
    assert.equal(
      subscriber.subscriptionStatus,
      'active',
      `Expected active status, got ${subscriber.subscriptionStatus}`,
    );
  },
);

Then<DaleWorld>(
  'there should be {int} room with name {string}',
  async function (count: number, name: string) {
    assert.ok(this.lastResponse, 'No response recorded');
    assert.ok(Array.isArray(this.lastResponse.body), 'Expected body to be an array');

    const matchingRooms = this.lastResponse.body.filter((r: any) => r.name === name);
    assert.equal(
      matchingRooms.length,
      count,
      `Expected ${count} room(s) with name "${name}", found ${matchingRooms.length}`,
    );
  },
);

Then<DaleWorld>("Tenant Beta's room should still exist", async function () {
  assert.ok(this.secondTenantToken, 'No second tenant token available');
  assert.ok(this.tenantBRoomId, 'No Tenant Beta room ID available');

  const response = await apiRequest(
    `${this.config.adminApiUrl}/api/rooms/${this.tenantBRoomId}`,
    'GET',
    { token: this.secondTenantToken },
  );

  assert.equal(response.status, 200, "Tenant Beta's room should still exist");
});

// Note: "the response status should be {int} or {int}" is defined in common.steps.ts
