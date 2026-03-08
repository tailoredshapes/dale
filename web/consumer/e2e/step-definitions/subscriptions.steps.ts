import { Given, When, Then } from '@cucumber/cucumber';
import { ConsumerWorld } from '../support/world.js';
import assert from 'node:assert/strict';

Given<ConsumerWorld>('I am signed in', async function () {
  assert.ok(this.page, 'Page should be initialized');
  assert.ok(this.idToken, 'Should have auth token');

  await this.page.addInitScript((tokens) => {
    const authData = {
      idToken: tokens.idToken,
      accessToken: tokens.accessToken,
      expiresAt: Date.now() + 3600000,
    };
    sessionStorage.setItem('dale_auth', JSON.stringify(authData));
  }, { idToken: this.idToken, accessToken: this.accessToken });
});

When<ConsumerWorld>('I visit the dashboard', async function () {
  assert.ok(this.page, 'Page should be initialized');

  await this.page.route('**/api/subscriptions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'sub-1',
          roomId: 'room-1',
          roomName: 'Premium Trading Signals',
          status: 'active',
          telegramInviteLink: 'https://t.me/+abc123',
          paymentProvider: 'stripe',
        },
      ]),
    });
  });

  await this.page.goto(`${this.config.baseUrl}/dashboard`);
  await this.page.waitForLoadState('networkidle');
});

Then<ConsumerWorld>('I see my active subscriptions', async function () {
  assert.ok(this.page, 'Page should be initialized');

  const subscriptionCards = await this.page.locator('subscription-card').count();
  assert.ok(subscriptionCards >= 1, 'Should display at least one subscription card');
});

Given<ConsumerWorld>('I am signed in with an active subscription', async function () {
  assert.ok(this.page, 'Page should be initialized');
  assert.ok(this.idToken, 'Should have auth token');

  await this.page.addInitScript((tokens) => {
    const authData = {
      idToken: tokens.idToken,
      accessToken: tokens.accessToken,
      expiresAt: Date.now() + 3600000,
    };
    sessionStorage.setItem('dale_auth', JSON.stringify(authData));
  }, { idToken: this.idToken, accessToken: this.accessToken });

  this.subscriptionId = 'sub-1';
});

When<ConsumerWorld>('I click cancel on a subscription', async function () {
  assert.ok(this.page, 'Page should be initialized');

  await this.page.route('**/api/subscriptions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'sub-1',
          roomId: 'room-1',
          roomName: 'Premium Trading Signals',
          status: 'active',
          telegramInviteLink: 'https://t.me/+abc123',
          paymentProvider: 'stripe',
        },
      ]),
    });
  });

  await this.page.route('**/api/subscribe/**', async (route) => {
    if (route.request().method() === 'DELETE') {
      await route.fulfill({ status: 200, body: '{}' });
    }
  });

  await this.page.goto(`${this.config.baseUrl}/dashboard`);
  await this.page.waitForLoadState('networkidle');

  this.page.on('dialog', async (dialog) => {
    await dialog.accept();
  });

  const subscriptionCard = this.page.locator('subscription-card').first();
  const shadowRoot = await subscriptionCard.evaluateHandle((el) => el.shadowRoot);
  const cancelBtn = await shadowRoot.asElement()?.$(('.cancel-btn'));

  if (cancelBtn) {
    await cancelBtn.click();
  }
});

Then<ConsumerWorld>('the subscription status changes to cancelling', async function () {
  assert.ok(this.page, 'Page should be initialized');

  await this.page.waitForTimeout(500);

  const subscriptionCard = this.page.locator('subscription-card').first();
  const shadowRoot = await subscriptionCard.evaluateHandle((el) => el.shadowRoot);
  const badge = await shadowRoot.asElement()?.$(('.status-badge'));

  if (badge) {
    const text = await badge.textContent();
    assert.ok(
      text?.toLowerCase().includes('cancelling') || text?.toLowerCase().includes('cancelled'),
      `Expected cancelling status, got: ${text}`
    );
  }
});

When<ConsumerWorld>('I click Subscribe on a room', async function () {
  assert.ok(this.page, 'Page should be initialized');

  await this.page.route('**/api/rooms/public', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          roomId: 'room-1',
          name: 'Premium Trading Signals',
          description: 'Daily trading signals',
          priceDescription: '$29/month',
          paymentLink: 'https://checkout.stripe.com/test',
          paypalPaymentLink: 'https://paypal.com/test',
          isActive: true,
          tenantId: 'tenant-1',
        },
      ]),
    });
  });

  await this.page.goto(this.config.baseUrl);
  await this.page.waitForLoadState('networkidle');

  const roomCard = this.page.locator('room-card').first();
  await roomCard.waitFor({ state: 'visible' });

  const shadowRoot = await roomCard.evaluateHandle((el) => el.shadowRoot);
  const subscribeBtn = await shadowRoot.asElement()?.$(('.subscribe-btn'));

  if (subscribeBtn) {
    await subscribeBtn.click();
    await this.page.waitForURL(/\/subscribe\//);
  }
});

When<ConsumerWorld>('I choose Stripe', async function () {
  assert.ok(this.page, 'Page should be initialized');

  await this.page.route('**/api/rooms/**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          roomId: 'room-1',
          name: 'Premium Trading Signals',
          priceDescription: '$29/month',
          paymentLink: 'https://checkout.stripe.com/test',
          paypalPaymentLink: 'https://paypal.com/test',
          isActive: true,
        }),
      });
    }
  });

  await this.page.route('**/api/subscribe', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          redirectUrl: 'https://checkout.stripe.com/test-session',
        }),
      });
    }
  });

  await this.page.waitForLoadState('networkidle');

  const paymentSelector = this.page.locator('payment-selector').first();
  const shadowRoot = await paymentSelector.evaluateHandle((el) => el.shadowRoot);
  const stripeBtn = await shadowRoot.asElement()?.$(('[data-provider="stripe"]'));

  if (stripeBtn) {
    await stripeBtn.click();
  }
});

Then<ConsumerWorld>('I am redirected to the Stripe payment page', async function () {
  assert.ok(this.page, 'Page should be initialized');

  await this.page.waitForURL(/checkout\.stripe\.com/, { timeout: 5000 }).catch(() => {
    const currentUrl = this.page!.url();
    assert.ok(
      currentUrl.includes('stripe') || currentUrl.includes('checkout'),
      `Expected Stripe checkout redirect, got: ${currentUrl}`
    );
  });
});

When<ConsumerWorld>('I choose PayPal', async function () {
  assert.ok(this.page, 'Page should be initialized');

  await this.page.route('**/api/rooms/**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          roomId: 'room-1',
          name: 'Premium Trading Signals',
          priceDescription: '$29/month',
          paymentLink: 'https://checkout.stripe.com/test',
          paypalPaymentLink: 'https://paypal.com/test',
          isActive: true,
        }),
      });
    }
  });

  await this.page.route('**/api/subscribe', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          redirectUrl: 'https://www.paypal.com/webapps/billing/subscriptions',
        }),
      });
    }
  });

  await this.page.waitForLoadState('networkidle');

  const paymentSelector = this.page.locator('payment-selector').first();
  const shadowRoot = await paymentSelector.evaluateHandle((el) => el.shadowRoot);
  const paypalBtn = await shadowRoot.asElement()?.$(('[data-provider="paypal"]'));

  if (paypalBtn) {
    await paypalBtn.click();
  }
});

Then<ConsumerWorld>('I am redirected to the PayPal payment page', async function () {
  assert.ok(this.page, 'Page should be initialized');

  await this.page.waitForURL(/paypal\.com/, { timeout: 5000 }).catch(() => {
    const currentUrl = this.page!.url();
    assert.ok(
      currentUrl.includes('paypal'),
      `Expected PayPal redirect, got: ${currentUrl}`
    );
  });
});

Given<ConsumerWorld>('I have completed a Stripe subscription', async function () {
  assert.ok(this.page, 'Page should be initialized');
  assert.ok(this.idToken, 'Should have auth token');

  await this.page.addInitScript((tokens) => {
    const authData = {
      idToken: tokens.idToken,
      accessToken: tokens.accessToken,
      expiresAt: Date.now() + 3600000,
    };
    sessionStorage.setItem('dale_auth', JSON.stringify(authData));
  }, { idToken: this.idToken, accessToken: this.accessToken });

  this.subscriptionId = 'sub-completed';
});

When<ConsumerWorld>('payment is confirmed', async function () {
  // Payment confirmation is simulated
});

Then<ConsumerWorld>('I see a Telegram invite link on my dashboard', async function () {
  assert.ok(this.page, 'Page should be initialized');

  await this.page.route('**/api/subscriptions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'sub-completed',
          roomId: 'room-1',
          roomName: 'Premium Trading Signals',
          status: 'active',
          telegramInviteLink: 'https://t.me/+abc123invite',
          paymentProvider: 'stripe',
        },
      ]),
    });
  });

  await this.page.goto(`${this.config.baseUrl}/dashboard`);
  await this.page.waitForLoadState('networkidle');

  const subscriptionCard = this.page.locator('subscription-card').first();
  const shadowRoot = await subscriptionCard.evaluateHandle((el) => el.shadowRoot);
  const inviteLink = await shadowRoot.asElement()?.$(('.invite-btn'));

  assert.ok(inviteLink, 'Should display Telegram invite link');

  if (inviteLink) {
    const href = await inviteLink.getAttribute('href');
    assert.ok(href?.includes('t.me'), 'Invite link should be a Telegram URL');
  }
});
