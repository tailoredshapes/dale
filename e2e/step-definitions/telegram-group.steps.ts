import { Given, When, Then } from '@cucumber/cucumber';
import { DaleWorld } from '../support/world.js';
import { apiRequest } from '../support/http.js';
import { getSSMParameter } from '../support/ssm.js';
import { buildBotAddedToGroup, buildMessage, sendTelegramWebhook } from '../support/telegram.js';
import assert from 'node:assert/strict';

Given<DaleWorld>('I have retrieved the webhook secret', async function () {
  assert.ok(this.tenantIds.length > 0, 'No tenant onboarded');
  const tenantId = this.tenantIds[this.tenantIds.length - 1];
  const secret = await getSSMParameter(`/dale/tenants/${tenantId}/telegram-webhook-secret`, this.config);
  this.webhookSecret = secret;
  this.webhookSecrets.push(secret);
});

When<DaleWorld>('I simulate the bot being added to group {string}', async function (groupTitle: string) {
  assert.ok(this.webhookSecret, 'No webhook secret available');
  assert.ok(this.tenantIds.length > 0, 'No tenant onboarded');
  const tenantId = this.tenantIds[this.tenantIds.length - 1];
  this.telegramGroupId = -(Math.floor(Math.random() * 900000000) + 100000000);
  const payload = buildBotAddedToGroup({
    groupId: this.telegramGroupId,
    groupTitle,
  });
  const result = await sendTelegramWebhook(
    this.config.telegramWebhookUrl,
    this.webhookSecret,
    payload,
    tenantId,
  );
  this.lastResponse = { status: result.status, body: result.body, headers: new Headers() };
});

Given<DaleWorld>(
  'I have simulated the bot being added to group {string}',
  async function (groupTitle: string) {
    assert.ok(this.webhookSecret, 'No webhook secret available');
    assert.ok(this.idToken, 'No auth token available');
    assert.ok(this.tenantIds.length > 0, 'No tenant onboarded');
    const tenantId = this.tenantIds[this.tenantIds.length - 1];
    this.telegramGroupId = -(Math.floor(Math.random() * 900000000) + 100000000);
    const payload = buildBotAddedToGroup({
      groupId: this.telegramGroupId,
      groupTitle,
    });
    await sendTelegramWebhook(
      this.config.telegramWebhookUrl,
      this.webhookSecret,
      payload,
      tenantId,
    );
    // Wait for async processing
    await new Promise((r) => setTimeout(r, 1000));
    // Fetch rooms to find the auto-created one
    const response = await apiRequest(`${this.config.adminApiUrl}/api/rooms`, 'GET', {
      token: this.idToken,
    });
    assert.equal(response.status, 200, `List rooms failed: ${JSON.stringify(response.body)}`);
    assert.ok(Array.isArray(response.body), 'Expected rooms array');
    assert.ok(response.body.length > 0, 'Expected at least one room after bot added to group');
    this.lastRoomId = response.body[response.body.length - 1].roomId;
  },
);

Given<DaleWorld>(
  'I have activated the auto-created room with payment link {string}',
  async function (paymentLink: string) {
    assert.ok(this.idToken, 'No auth token available');
    assert.ok(this.lastRoomId, 'No room available to activate');
    const response = await apiRequest(
      `${this.config.adminApiUrl}/api/rooms/${this.lastRoomId}`,
      'PUT',
      {
        token: this.idToken,
        body: { paymentLink, isActive: true },
      },
    );
    assert.equal(response.status, 200, `Activate room failed: ${JSON.stringify(response.body)}`);

    // Track as Room A if not already set (for multi-room scenarios)
    if (!this.roomA) {
      this.roomA = {
        roomId: this.lastRoomId,
        telegramGroupId: this.telegramGroupId!,
      };
    }
  },
);

When<DaleWorld>('a user sends {string} in the group', async function (text: string) {
  assert.ok(this.webhookSecret, 'No webhook secret available');
  assert.ok(this.telegramGroupId, 'No telegram group ID available');
  assert.ok(this.tenantIds.length > 0, 'No tenant onboarded');
  const tenantId = this.tenantIds[this.tenantIds.length - 1];
  const payload = buildMessage({
    chatId: this.telegramGroupId,
    chatType: 'supergroup',
    text,
  });
  const result = await sendTelegramWebhook(
    this.config.telegramWebhookUrl,
    this.webhookSecret,
    payload,
    tenantId,
  );
  this.lastResponse = { status: result.status, body: result.body, headers: new Headers() };
});

When<DaleWorld>('a user sends {string} as a direct message', async function (text: string) {
  assert.ok(this.webhookSecret, 'No webhook secret available');
  assert.ok(this.tenantIds.length > 0, 'No tenant onboarded');
  const tenantId = this.tenantIds[this.tenantIds.length - 1];
  const payload = buildMessage({
    chatId: 111111,
    chatType: 'private',
    text,
  });
  const result = await sendTelegramWebhook(
    this.config.telegramWebhookUrl,
    this.webhookSecret,
    payload,
    tenantId,
  );
  this.lastResponse = { status: result.status, body: result.body, headers: new Headers() };
});

When<DaleWorld>('I list rooms via the admin API', async function () {
  assert.ok(this.idToken, 'No auth token available');
  this.lastResponse = await apiRequest(`${this.config.adminApiUrl}/api/rooms`, 'GET', {
    token: this.idToken,
  });
});

Then<DaleWorld>('there should be {int} room(s)', function (count: number) {
  assert.ok(this.lastResponse, 'No response recorded');
  assert.ok(Array.isArray(this.lastResponse.body), 'Expected body to be an array');
  assert.equal(this.lastResponse.body.length, count);
});

Then<DaleWorld>('the room should have name {string}', function (name: string) {
  assert.ok(this.lastResponse, 'No response recorded');
  assert.ok(Array.isArray(this.lastResponse.body), 'Expected body to be an array');
  const room = this.lastResponse.body.find((r: any) => r.name === name);
  assert.ok(room, `No room found with name "${name}"`);
  this.lastRoomId = room.roomId;
});

Then<DaleWorld>('the room should have a telegramGroupId', function () {
  assert.ok(this.lastResponse, 'No response recorded');
  assert.ok(Array.isArray(this.lastResponse.body), 'Expected body to be an array');
  const room = this.lastResponse.body.find((r: any) => r.roomId === this.lastRoomId);
  assert.ok(room, 'No room found');
  assert.ok(room.telegramGroupId !== undefined && room.telegramGroupId !== null, 'Expected telegramGroupId');
});

// Note: 'the room should not be active' is defined in admin-rooms-exhaustive.steps.ts
// and handles both single room (object) and list of rooms (array) responses

When<DaleWorld>("I check the auto-created room's subscribers", async function () {
  assert.ok(this.idToken, 'No auth token available');
  assert.ok(this.lastRoomId, 'No room available');
  this.lastResponse = await apiRequest(
    `${this.config.adminApiUrl}/api/rooms/${this.lastRoomId}/subscribers`,
    'GET',
    { token: this.idToken },
  );
});
