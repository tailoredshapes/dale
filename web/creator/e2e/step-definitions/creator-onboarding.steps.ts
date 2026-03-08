import { Given, When, Then } from '@cucumber/cucumber';
import { CreatorWorld } from '../support/world.js';
import assert from 'node:assert/strict';

Given<CreatorWorld>('I am a new creator', async function () {
  assert.ok(this.page, 'Page should be initialized');
  assert.ok(this.idToken, 'Should have auth token');

  await this.page.addInitScript((tokens) => {
    const authData = {
      idToken: tokens.idToken,
      accessToken: tokens.accessToken,
      expiresAt: Date.now() + 3600000,
    };
    sessionStorage.setItem('dale_creator_auth', JSON.stringify(authData));
  }, { idToken: this.idToken, accessToken: this.accessToken });

  await this.page.goto(`${this.config.baseUrl}/onboarding`);
  await this.page.waitForLoadState('networkidle');
});

When<CreatorWorld>('I complete onboarding with my bot token and payment keys', async function () {
  assert.ok(this.page, 'Page should be initialized');

  await this.page.route('**/api/tenant/onboard', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        tenantId: 'tenant-new',
        webhookRegistered: true,
      }),
    });
  });

  await this.page.route('**/api/tenant', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tenantId: 'tenant-new',
          displayName: 'Test Creator',
          webhookSecret: 'wh-secret-123',
        }),
      });
    }
  });

  const onboardingPage = this.page.locator('onboarding-page');
  await onboardingPage.waitFor({ state: 'visible' });

  const shadowRoot = await onboardingPage.evaluateHandle((el) => el.shadowRoot);

  const displayNameInput = await shadowRoot.asElement()?.$(('#displayName'));
  await displayNameInput?.fill('Test Creator');

  const nextBtn1 = await shadowRoot.asElement()?.$(('.next-btn'));
  await nextBtn1?.click();

  await this.page.waitForTimeout(300);

  const botTokenInput = await shadowRoot.asElement()?.$(('#telegramBotToken'));
  await botTokenInput?.fill('123456789:ABCdefGHI');

  const nextBtn2 = await shadowRoot.asElement()?.$(('.next-btn'));
  await nextBtn2?.click();

  await this.page.waitForTimeout(300);

  const stripeKeyInput = await shadowRoot.asElement()?.$(('#stripeSecretKey'));
  await stripeKeyInput?.fill('sk_test_123');

  const submitBtn = await shadowRoot.asElement()?.$(('.submit-btn'));
  await submitBtn?.click();
});

Then<CreatorWorld>('I see my creator dashboard', async function () {
  assert.ok(this.page, 'Page should be initialized');

  await this.page.route('**/api/rooms', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await this.page.waitForURL(/\/$/, { timeout: 10000 }).catch(() => {});

  const dashboardPage = this.page.locator('dashboard-page');
  await dashboardPage.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
});
