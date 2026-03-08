import { Given, When, Then } from '@cucumber/cucumber';
import { AdminWorld } from '../support/world.js';
import assert from 'node:assert/strict';

Given<AdminWorld>('I am signed in as admin', async function () {
  assert.ok(this.page, 'Page should be initialized');
  assert.ok(this.idToken, 'Should have auth token');

  await this.page.addInitScript((tokens) => {
    const authData = {
      idToken: tokens.idToken,
      accessToken: tokens.accessToken,
      expiresAt: Date.now() + 3600000,
    };
    sessionStorage.setItem('dale_admin_auth', JSON.stringify(authData));
  }, { idToken: this.idToken, accessToken: this.accessToken });
});

When<AdminWorld>('I visit the dashboard', async function () {
  assert.ok(this.page, 'Page should be initialized');

  await this.page.route('**/api/admin/stats', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        totalTenants: 25,
        activeTenants: 22,
        totalSubscriptions: 500,
        activeSubscriptions: 450,
        mrr: 12500,
      }),
    });
  });

  await this.page.route('**/api/admin/tenants', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          tenantId: 'tenant-1',
          displayName: 'Trading Pro',
          status: 'active',
          roomCount: 3,
          subscriberCount: 150,
          monthlyRevenue: 4500,
        },
        {
          tenantId: 'tenant-2',
          displayName: 'Fitness Coach',
          status: 'active',
          roomCount: 2,
          subscriberCount: 80,
          monthlyRevenue: 2400,
        },
      ]),
    });
  });

  await this.page.goto(this.config.baseUrl);
  await this.page.waitForLoadState('networkidle');
});

Then<AdminWorld>('I see total tenants, active subscriptions and MRR', async function () {
  assert.ok(this.page, 'Page should be initialized');

  const dashboardPage = this.page.locator('dashboard-page');
  await dashboardPage.waitFor({ state: 'visible' });

  const shadowRoot = await dashboardPage.evaluateHandle((el) => el.shadowRoot);

  const totalTenantsEl = await shadowRoot.asElement()?.$(('.total-tenants'));
  const totalTenants = await totalTenantsEl?.textContent();
  assert.ok(totalTenants === '25', `Expected 25 total tenants, got: ${totalTenants}`);

  const activeSubscriptionsEl = await shadowRoot.asElement()?.$(('.active-subscriptions'));
  const activeSubscriptions = await activeSubscriptionsEl?.textContent();
  assert.ok(activeSubscriptions === '450', `Expected 450 active subscriptions, got: ${activeSubscriptions}`);

  const mrrEl = await shadowRoot.asElement()?.$(('.mrr'));
  const mrr = await mrrEl?.textContent();
  assert.ok(mrr?.includes('12,500'), `Expected MRR $12,500, got: ${mrr}`);
});
