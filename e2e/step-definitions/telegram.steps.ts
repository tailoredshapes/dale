import { When } from '@cucumber/cucumber';
import { DaleWorld } from '../support/world.js';
import assert from 'node:assert/strict';

When<DaleWorld>('I send a POST to the Telegram webhook without a tenant', async function () {
  const response = await fetch(this.config.telegramWebhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-telegram-bot-api-secret-token': 'test-secret',
    },
    body: JSON.stringify({ update_id: 1 }),
  });

  this.lastResponse = {
    status: response.status,
    body: await response.text(),
    headers: response.headers,
  };
});

When<DaleWorld>('I send a POST to the Telegram webhook without a secret', async function () {
  assert.ok(this.tenantIds.length > 0, 'No tenant onboarded');
  const tenantId = this.tenantIds[this.tenantIds.length - 1];

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
});

When<DaleWorld>(
  'I send a POST to the Telegram webhook with an invalid secret',
  async function () {
    assert.ok(this.tenantIds.length > 0, 'No tenant onboarded');
    const tenantId = this.tenantIds[this.tenantIds.length - 1];

    const response = await fetch(`${this.config.telegramWebhookUrl}?tenant=${tenantId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-bot-api-secret-token': 'invalid-secret',
      },
      body: JSON.stringify({ update_id: 1 }),
    });

    this.lastResponse = {
      status: response.status,
      body: await response.text(),
      headers: response.headers,
    };
  },
);
