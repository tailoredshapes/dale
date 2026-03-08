import { Given, When, Then } from '@cucumber/cucumber';
import { DaleWorld } from '../support/world.js';
import { apiRequest } from '../support/http.js';
import { cacheTenantSecrets } from '../support/ssm.js';
import {
  createGroup,
  sendMessageAsUser,
  sendDmToBot,
  waitForBotReply,
  waitForDmReply,
} from '../support/gramjs.js';
import assert from 'node:assert/strict';

Given<DaleWorld>('I have onboarded a tenant with the test bot', async function () {
  assert.ok(this.idToken, 'No auth token available');
  const botToken = this.config.telegramTestBotToken;
  assert.ok(botToken, 'No test bot token configured');

  const response = await apiRequest(`${this.config.adminApiUrl}/api/tenant/onboard`, 'POST', {
    token: this.idToken,
    body: {
      displayName: 'Real TG E2E',
      telegramBotToken: botToken,
      stripeSecretKey: 'sk_test_fake_for_e2e',
      stripeWebhookSecret: 'whsec_fake_for_e2e',
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

When<DaleWorld>('I create a Telegram group {string}', async function (title: string) {
  assert.ok(this.telegramClient, 'No Telegram client connected');
  const botUsername = this.config.telegramTestBotUsername!;

  const { chatId } = await createGroup(this.telegramClient, title, botUsername);
  this.telegramRealChatId = chatId;
});

When<DaleWorld>('I add the bot to the group', async function () {
  // Bot was already added during group creation (createGroup invites the bot)
  // This step exists for readability in the Gherkin scenario
  assert.ok(this.telegramRealChatId, 'No Telegram group created');
});

Then<DaleWorld>(
  'a room should be auto-created within {int} seconds',
  async function (timeoutSec: number) {
    assert.ok(this.idToken, 'No auth token available');
    const deadline = Date.now() + timeoutSec * 1000;

    while (Date.now() < deadline) {
      const response = await apiRequest(`${this.config.adminApiUrl}/api/rooms`, 'GET', {
        token: this.idToken,
      });
      if (response.status === 200 && Array.isArray(response.body) && response.body.length > 0) {
        this.lastRoomId = response.body[response.body.length - 1].roomId;
        this.lastResponse = response;
        return;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    assert.fail(`No room auto-created within ${timeoutSec} seconds`);
  },
);

When<DaleWorld>(
  'I activate the auto-created room with payment link {string}',
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
  },
);

When<DaleWorld>('I send {string} in the Telegram group', async function (text: string) {
  assert.ok(this.telegramClient, 'No Telegram client connected');
  assert.ok(this.telegramRealChatId, 'No Telegram group created');

  // Capture existing message IDs before sending, so waitForBotReply knows what's new
  await sendMessageAsUser(this.telegramClient, this.telegramRealChatId, text);
});

When<DaleWorld>('I send {string} as a DM to the bot', async function (text: string) {
  assert.ok(this.telegramClient, 'No Telegram client connected');
  const botUsername = this.config.telegramTestBotUsername!;

  await sendDmToBot(this.telegramClient, botUsername, text);
});

Then<DaleWorld>('the bot should reply within {int} seconds', async function (timeoutSec: number) {
  assert.ok(this.telegramClient, 'No Telegram client connected');
  const botUsername = this.config.telegramTestBotUsername!;

  let reply: string | null;
  if (this.telegramRealChatId) {
    reply = await waitForBotReply(
      this.telegramClient,
      this.telegramRealChatId,
      botUsername,
      timeoutSec * 1000,
    );
  } else {
    reply = await waitForDmReply(this.telegramClient, botUsername, timeoutSec * 1000);
  }

  assert.ok(reply !== null, `Bot did not reply within ${timeoutSec} seconds`);
  this.botReply = reply;
});

Then<DaleWorld>('the reply should contain {string}', function (expected: string) {
  assert.ok(this.botReply, 'No bot reply recorded');
  assert.ok(
    this.botReply.toLowerCase().includes(expected.toLowerCase()),
    `Expected reply to contain "${expected}", got: "${this.botReply}"`,
  );
});
