/**
 * Step definitions for PayPal subscription lifecycle scenarios
 */
import { Given, When, Then } from '@cucumber/cucumber';
import { DaleWorld } from '../support/world.js';
import { apiRequest } from '../support/http.js';
import {
  sendPayPalWebhook,
  buildSubscriptionActivatedEvent,
  buildSubscriptionCancelledEvent,
  buildSubscriptionSuspendedEvent,
  buildSubscriptionActivatedNoCustomId,
  buildSubscriptionActivatedWrongTenant,
} from '../support/paypal.js';
import assert from 'node:assert/strict';

// Generate unique IDs for each user's PayPal data
function generatePayPalIds(userId: number): { payerId: string; subscriptionId: string } {
  return {
    payerId: `PAYER_${userId}_${Date.now()}`,
    subscriptionId: `I-${userId}${Date.now()}`,
  };
}

// Helper to create a user with an initial PayPal subscription state
async function createPayPalUserSubscription(
  world: DaleWorld,
  userId: number,
  status: 'active' | 'cancelled',
): Promise<{ payerId: string; subscriptionId: string }> {
  assert.ok(world.tenantIds.length > 0, 'No tenant onboarded');
  assert.ok(world.lastRoomId, 'No room available');

  const tenantId = world.tenantIds[world.tenantIds.length - 1];
  const ids = generatePayPalIds(userId);

  // Create the user via BILLING.SUBSCRIPTION.ACTIVATED
  const activatedEvent = buildSubscriptionActivatedEvent(
    tenantId,
    userId,
    world.lastRoomId,
    ids.payerId,
    ids.subscriptionId,
  );
  await sendPayPalWebhook(world.config.paypalWebhookUrl, tenantId, activatedEvent);

  // Wait for processing
  await new Promise((r) => setTimeout(r, 500));

  // If status is cancelled, send cancellation event
  if (status === 'cancelled') {
    const cancelledEvent = buildSubscriptionCancelledEvent(ids.payerId, ids.subscriptionId);
    await sendPayPalWebhook(world.config.paypalWebhookUrl, tenantId, cancelledEvent);
    await new Promise((r) => setTimeout(r, 500));
  }

  // Store for later use
  world.paypalPayerId = ids.payerId;
  world.paypalSubscriptionId = ids.subscriptionId;

  return ids;
}

// ============== Given Steps ==============

Given<DaleWorld>(
  'user {int} has an active PayPal subscription in that room',
  async function (userId: number) {
    await createPayPalUserSubscription(this, userId, 'active');
  },
);

Given<DaleWorld>(
  'user {int} has a cancelled PayPal subscription in that room',
  async function (userId: number) {
    await createPayPalUserSubscription(this, userId, 'cancelled');
  },
);

// ============== When Steps ==============

When<DaleWorld>(
  'a PayPal BILLING.SUBSCRIPTION.ACTIVATED event fires for user {int} in that room',
  async function (userId: number) {
    assert.ok(this.tenantIds.length > 0, 'No tenant onboarded');
    assert.ok(this.lastRoomId, 'No room available');

    const tenantId = this.tenantIds[this.tenantIds.length - 1];
    const ids = generatePayPalIds(userId);

    const event = buildSubscriptionActivatedEvent(
      tenantId,
      userId,
      this.lastRoomId,
      ids.payerId,
      ids.subscriptionId,
    );

    const result = await sendPayPalWebhook(
      this.config.paypalWebhookUrl,
      tenantId,
      event,
    );

    this.lastResponse = {
      status: result.status,
      body: result.body,
      headers: new Headers(),
    };

    this.paypalPayerId = ids.payerId;
    this.paypalSubscriptionId = ids.subscriptionId;

    // Wait for processing
    await new Promise((r) => setTimeout(r, 500));
  },
);

When<DaleWorld>(
  'a PayPal BILLING.SUBSCRIPTION.CANCELLED event fires for user {int}',
  async function (userId: number) {
    assert.ok(this.tenantIds.length > 0, 'No tenant onboarded');
    assert.ok(this.paypalPayerId, 'No PayPal payer ID available');
    assert.ok(this.paypalSubscriptionId, 'No PayPal subscription ID available');

    const tenantId = this.tenantIds[this.tenantIds.length - 1];

    const event = buildSubscriptionCancelledEvent(
      this.paypalPayerId,
      this.paypalSubscriptionId,
    );

    const result = await sendPayPalWebhook(
      this.config.paypalWebhookUrl,
      tenantId,
      event,
    );

    this.lastResponse = {
      status: result.status,
      body: result.body,
      headers: new Headers(),
    };

    // Wait for processing
    await new Promise((r) => setTimeout(r, 500));
  },
);

When<DaleWorld>(
  'a PayPal BILLING.SUBSCRIPTION.SUSPENDED event fires for user {int}',
  async function (userId: number) {
    assert.ok(this.tenantIds.length > 0, 'No tenant onboarded');
    assert.ok(this.paypalPayerId, 'No PayPal payer ID available');
    assert.ok(this.paypalSubscriptionId, 'No PayPal subscription ID available');

    const tenantId = this.tenantIds[this.tenantIds.length - 1];

    const event = buildSubscriptionSuspendedEvent(
      this.paypalPayerId,
      this.paypalSubscriptionId,
    );

    const result = await sendPayPalWebhook(
      this.config.paypalWebhookUrl,
      tenantId,
      event,
    );

    this.lastResponse = {
      status: result.status,
      body: result.body,
      headers: new Headers(),
    };

    // Wait for processing
    await new Promise((r) => setTimeout(r, 500));
  },
);

When<DaleWorld>(
  'I send a POST to the PayPal webhook with bad signature',
  async function () {
    // Send to PayPal webhook without proper tenant or with invalid payload
    const response = await fetch(this.config.paypalWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ event_type: 'test' }),
    });

    this.lastResponse = {
      status: response.status,
      body: await response.text(),
      headers: response.headers,
    };
  },
);

When<DaleWorld>(
  'a PayPal BILLING.SUBSCRIPTION.ACTIVATED event fires with no custom_id',
  async function () {
    assert.ok(this.tenantIds.length > 0, 'No tenant onboarded');

    const tenantId = this.tenantIds[this.tenantIds.length - 1];
    const ids = generatePayPalIds(99999);

    const event = buildSubscriptionActivatedNoCustomId(
      ids.payerId,
      ids.subscriptionId,
    );

    const result = await sendPayPalWebhook(
      this.config.paypalWebhookUrl,
      tenantId,
      event,
    );

    this.lastResponse = {
      status: result.status,
      body: result.body,
      headers: new Headers(),
    };

    // Wait for processing
    await new Promise((r) => setTimeout(r, 500));
  },
);

When<DaleWorld>(
  'a PayPal BILLING.SUBSCRIPTION.ACTIVATED event fires with tenant {string} in custom_id',
  async function (wrongTenantId: string) {
    assert.ok(this.tenantIds.length > 0, 'No tenant onboarded');

    const tenantId = this.tenantIds[this.tenantIds.length - 1];
    const ids = generatePayPalIds(99999);

    const event = buildSubscriptionActivatedWrongTenant(
      wrongTenantId,
      ids.payerId,
      ids.subscriptionId,
    );

    const result = await sendPayPalWebhook(
      this.config.paypalWebhookUrl,
      tenantId,
      event,
    );

    this.lastResponse = {
      status: result.status,
      body: result.body,
      headers: new Headers(),
    };

    // Wait for processing
    await new Promise((r) => setTimeout(r, 500));
  },
);

// Note: The Then steps for PayPal reuse the same assertions as Stripe
// They're already defined in stripe-lifecycle.steps.ts:
// - the user {int} should have an active subscription in that room
// - the user {int} should have a cancelled subscription in that room
// - the user {int} should have a past_due subscription in that room
// - the Telegram mock should have received a message to user {int} containing {string}
// - the Telegram mock should have received an unban call for user {int}
// - no user room mapping should be created
