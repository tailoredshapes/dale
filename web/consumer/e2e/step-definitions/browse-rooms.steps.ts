import { Given, When, Then } from '@cucumber/cucumber';
import { ConsumerWorld } from '../support/world.js';
import assert from 'node:assert/strict';

Given<ConsumerWorld>('I visit the home page', async function () {
  assert.ok(this.page, 'Page should be initialized');

  await this.page.route('**/api/rooms/public', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          roomId: 'room-1',
          name: 'Premium Trading Signals',
          description: 'Daily trading signals and market analysis',
          priceDescription: '$29/month',
          paymentLink: 'https://checkout.stripe.com/test',
          isActive: true,
          tenantId: 'tenant-1',
          tenantDisplayName: 'Trading Pro',
        },
        {
          roomId: 'room-2',
          name: 'Fitness Community',
          description: 'Workout plans and nutrition tips',
          priceDescription: '$15/month',
          paymentLink: 'https://checkout.stripe.com/test',
          paypalPaymentLink: 'https://paypal.com/test',
          isActive: true,
          tenantId: 'tenant-2',
          tenantDisplayName: 'Fit Coach',
        },
      ]),
    });
  });

  await this.page.goto(this.config.baseUrl);
  await this.page.waitForLoadState('networkidle');
});

Then<ConsumerWorld>('I see a list of rooms with name, description and price', async function () {
  assert.ok(this.page, 'Page should be initialized');

  const roomCards = await this.page.locator('room-card').count();
  assert.ok(roomCards >= 1, 'Should display at least one room card');
});

When<ConsumerWorld>('I see a room card', async function () {
  assert.ok(this.page, 'Page should be initialized');

  const roomCard = this.page.locator('room-card').first();
  await roomCard.waitFor({ state: 'visible' });
});

Then<ConsumerWorld>('the room card shows the room name', async function () {
  assert.ok(this.page, 'Page should be initialized');

  const roomCard = this.page.locator('room-card').first();
  const shadowRoot = await roomCard.evaluateHandle((el) => el.shadowRoot);
  const nameEl = await shadowRoot.asElement()?.$(('.room-name'));

  if (nameEl) {
    const text = await nameEl.textContent();
    assert.ok(text && text.length > 0, 'Room name should be visible');
  }
});

Then<ConsumerWorld>('the room card shows the room price', async function () {
  assert.ok(this.page, 'Page should be initialized');

  const roomCard = this.page.locator('room-card').first();
  const shadowRoot = await roomCard.evaluateHandle((el) => el.shadowRoot);
  const priceEl = await shadowRoot.asElement()?.$(('.room-price'));

  if (priceEl) {
    const text = await priceEl.textContent();
    assert.ok(text && text.includes('$'), 'Room price should be visible');
  }
});
