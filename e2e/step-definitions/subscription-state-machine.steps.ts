/**
 * Step definitions for subscription state machine scenarios
 * Handles multi-room scenarios and state transitions
 */
import { Given, When, Then } from '@cucumber/cucumber';
import { DaleWorld } from '../support/world.js';
import { apiRequest } from '../support/http.js';
import {
  sendStripeWebhook,
  getStripeWebhookSecret,
  buildCheckoutCompletedEvent,
  buildSubscriptionDeletedEvent,
} from '../support/stripe.js';
import assert from 'node:assert/strict';

// ============== Given Steps for Multi-Room Scenarios ==============

Given<DaleWorld>(
  'I have activated the second room with payment link {string}',
  async function (paymentLink: string) {
    assert.ok(this.idToken, 'No auth token available');
    assert.ok(this.lastRoomId, 'No room available to activate');

    // Store the current room as Room B
    this.roomB = {
      roomId: this.lastRoomId,
      telegramGroupId: this.telegramGroupId!,
    };

    const response = await apiRequest(
      `${this.config.adminApiUrl}/api/rooms/${this.lastRoomId}`,
      'PUT',
      {
        token: this.idToken,
        body: { paymentLink, isActive: true },
      },
    );
    assert.equal(response.status, 200, `Activate second room failed: ${JSON.stringify(response.body)}`);
  },
);

Given<DaleWorld>(
  'user {int} has an active subscription in Room A',
  async function (userId: number) {
    assert.ok(this.tenantIds.length > 0, 'No tenant onboarded');
    assert.ok(this.roomA, 'Room A not defined');

    const tenantId = this.tenantIds[this.tenantIds.length - 1];
    const stripeSecret = await getStripeWebhookSecret(tenantId, this.config);

    const customerId = `cus_roomA_${userId}_${Date.now()}`;
    const subscriptionId = `sub_roomA_${userId}_${Date.now()}`;

    const event = buildCheckoutCompletedEvent(
      tenantId,
      userId,
      this.roomA.roomId,
      customerId,
      subscriptionId,
    );

    await sendStripeWebhook(this.config.stripeWebhookUrl, tenantId, stripeSecret, event);
    await new Promise((r) => setTimeout(r, 500));

    // Store Room A subscription info
    this.roomA.stripeSubscriptionId = subscriptionId;
    this.stripeCustomerId = customerId;
  },
);

Given<DaleWorld>(
  'user {int} has an active subscription in Room B',
  async function (userId: number) {
    assert.ok(this.tenantIds.length > 0, 'No tenant onboarded');
    assert.ok(this.roomB, 'Room B not defined');

    const tenantId = this.tenantIds[this.tenantIds.length - 1];
    const stripeSecret = await getStripeWebhookSecret(tenantId, this.config);

    const customerId = this.stripeCustomerId || `cus_roomB_${userId}_${Date.now()}`;
    const subscriptionId = `sub_roomB_${userId}_${Date.now()}`;

    const event = buildCheckoutCompletedEvent(
      tenantId,
      userId,
      this.roomB.roomId,
      customerId,
      subscriptionId,
    );

    await sendStripeWebhook(this.config.stripeWebhookUrl, tenantId, stripeSecret, event);
    await new Promise((r) => setTimeout(r, 500));

    // Store Room B subscription info
    this.roomB.stripeSubscriptionId = subscriptionId;
    if (!this.stripeCustomerId) {
      this.stripeCustomerId = customerId;
    }
  },
);

// Note: Room A is tracked when "I have activated the auto-created room with payment link" is first called
// This is handled in telegram-group.steps.ts

// ============== When Steps ==============

When<DaleWorld>(
  "a Stripe customer.subscription.deleted event fires for user {int}'s Room A subscription",
  async function (userId: number) {
    assert.ok(this.tenantIds.length > 0, 'No tenant onboarded');
    assert.ok(this.roomA?.stripeSubscriptionId, 'No Room A subscription ID available');
    assert.ok(this.stripeCustomerId, 'No Stripe customer ID available');

    const tenantId = this.tenantIds[this.tenantIds.length - 1];
    const stripeSecret = await getStripeWebhookSecret(tenantId, this.config);

    const event = buildSubscriptionDeletedEvent(
      this.stripeCustomerId,
      this.roomA.stripeSubscriptionId,
    );

    const result = await sendStripeWebhook(
      this.config.stripeWebhookUrl,
      tenantId,
      stripeSecret,
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

// ============== Then Steps ==============

Then<DaleWorld>(
  'the user {int} should have a cancelled subscription in Room A',
  async function (userId: number) {
    assert.ok(this.idToken, 'No auth token available');
    assert.ok(this.roomA, 'Room A not defined');

    const response = await apiRequest(
      `${this.config.adminApiUrl}/api/rooms/${this.roomA.roomId}/subscribers`,
      'GET',
      { token: this.idToken },
    );

    assert.equal(response.status, 200, `Failed to get subscribers: ${JSON.stringify(response.body)}`);
    assert.ok(Array.isArray(response.body), 'Expected subscribers array');

    const subscriber = response.body.find((s: any) => s.telegramUserId === userId);
    assert.ok(subscriber, `User ${userId} not found in Room A subscribers`);
    assert.equal(
      subscriber.subscriptionStatus,
      'cancelled',
      `Expected cancelled status in Room A, got ${subscriber.subscriptionStatus}`,
    );
  },
);

Then<DaleWorld>(
  'the user {int} should have an active subscription in Room B',
  async function (userId: number) {
    assert.ok(this.idToken, 'No auth token available');
    assert.ok(this.roomB, 'Room B not defined');

    const response = await apiRequest(
      `${this.config.adminApiUrl}/api/rooms/${this.roomB.roomId}/subscribers`,
      'GET',
      { token: this.idToken },
    );

    assert.equal(response.status, 200, `Failed to get subscribers: ${JSON.stringify(response.body)}`);
    assert.ok(Array.isArray(response.body), 'Expected subscribers array');

    const subscriber = response.body.find((s: any) => s.telegramUserId === userId);
    assert.ok(subscriber, `User ${userId} not found in Room B subscribers`);
    assert.equal(
      subscriber.subscriptionStatus,
      'active',
      `Expected active status in Room B, got ${subscriber.subscriptionStatus}`,
    );
  },
);
