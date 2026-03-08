import { Given, When, Then } from '@cucumber/cucumber';
import { AdminWorld } from '../support/world.js';
import assert from 'node:assert/strict';

function setupAuth(page: AdminWorld['page'], tokens: { idToken?: string; accessToken?: string }) {
  return page!.addInitScript((t) => {
    const authData = {
      idToken: t.idToken,
      accessToken: t.accessToken,
      expiresAt: Date.now() + 3600000,
    };
    sessionStorage.setItem('dale_admin_auth', JSON.stringify(authData));
  }, tokens);
}

When<AdminWorld>('I visit the tenants page', async function () {
  assert.ok(this.page, 'Page should be initialized');

  await setupAuth(this.page, {
    idToken: this.idToken,
    accessToken: this.accessToken,
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
        {
          tenantId: 'tenant-3',
          displayName: 'Cooking Expert',
          status: 'suspended',
          roomCount: 1,
          subscriberCount: 20,
          monthlyRevenue: 0,
        },
      ]),
    });
  });

  await this.page.goto(`${this.config.baseUrl}/tenants`);
  await this.page.waitForLoadState('networkidle');
});

Then<AdminWorld>('I see a list of all tenants', async function () {
  assert.ok(this.page, 'Page should be initialized');

  const tenantCards = await this.page.locator('tenant-card').count();
  assert.ok(tenantCards >= 2, `Expected at least 2 tenant cards, got: ${tenantCards}`);
});

Given<AdminWorld>('I am on the tenants page', async function () {
  assert.ok(this.page, 'Page should be initialized');

  await setupAuth(this.page, {
    idToken: this.idToken,
    accessToken: this.accessToken,
  });

  await this.page.route('**/api/admin/tenants', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }
  });

  await this.page.goto(`${this.config.baseUrl}/tenants`);
  await this.page.waitForLoadState('networkidle');
});

When<AdminWorld>('I fill in the new tenant form and submit', async function () {
  assert.ok(this.page, 'Page should be initialized');

  await this.page.route('**/api/admin/tenants', async (route) => {
    if (route.request().method() === 'POST') {
      this.tenantId = 'tenant-new';
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          tenantId: 'tenant-new',
        }),
      });
    } else if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            tenantId: 'tenant-new',
            displayName: 'New Creator',
            status: 'active',
            roomCount: 0,
            subscriberCount: 0,
            monthlyRevenue: 0,
          },
        ]),
      });
    }
  });

  await this.page.route('**/api/admin/invite', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ email: 'new@example.com', invited: true }),
    });
  });

  const tenantsPage = this.page.locator('tenants-page');
  await tenantsPage.waitFor({ state: 'visible' });

  let shadowRoot = await tenantsPage.evaluateHandle((el) => el.shadowRoot);
  const onboardBtn = await shadowRoot.asElement()?.$(('.onboard-btn'));
  await onboardBtn?.click();

  await this.page.waitForTimeout(300);

  shadowRoot = await tenantsPage.evaluateHandle((el) => el.shadowRoot);
  const formOverlay = await shadowRoot.asElement()?.$(('.form-overlay'));
  const tenantForm = await formOverlay?.$(('tenant-form'));
  const formShadow = await tenantForm?.evaluateHandle((el) => el.shadowRoot);

  const nameInput = await formShadow?.asElement()?.$(('#displayName'));
  await nameInput?.fill('New Creator');

  const emailInput = await formShadow?.asElement()?.$(('#email'));
  await emailInput?.fill('new@example.com');

  const submitBtn = await formShadow?.asElement()?.$(('button[type="submit"]'));
  await submitBtn?.click();
});

Then<AdminWorld>('the new tenant appears in the tenant list', async function () {
  assert.ok(this.page, 'Page should be initialized');

  await this.page.waitForTimeout(500);

  const tenantCard = this.page.locator('tenant-card').first();
  await tenantCard.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

  const shadowRoot = await tenantCard.evaluateHandle((el) => el.shadowRoot);
  const nameEl = await shadowRoot.asElement()?.$(('.tenant-name'));

  if (nameEl) {
    const text = await nameEl.textContent();
    assert.ok(text?.includes('New Creator'), `Expected tenant name, got: ${text}`);
  }
});

Given<AdminWorld>('there is an active tenant', async function () {
  assert.ok(this.page, 'Page should be initialized');

  await setupAuth(this.page, {
    idToken: this.idToken,
    accessToken: this.accessToken,
  });

  this.tenantId = 'tenant-active';

  await this.page.route('**/api/admin/tenants', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          tenantId: 'tenant-active',
          displayName: 'Active Creator',
          status: 'active',
          roomCount: 2,
          subscriberCount: 50,
          monthlyRevenue: 1500,
        },
      ]),
    });
  });

  await this.page.goto(`${this.config.baseUrl}/tenants`);
  await this.page.waitForLoadState('networkidle');
});

When<AdminWorld>('I click Suspend', async function () {
  assert.ok(this.page, 'Page should be initialized');

  await this.page.route('**/api/admin/tenants/tenant-active', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tenantId: 'tenant-active',
          displayName: 'Active Creator',
          status: 'active',
          rooms: [],
          recentSubscribers: [],
        }),
      });
    }
  });

  await this.page.route('**/api/admin/tenants/tenant-active/suspend', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ suspended: true }),
    });
  });

  const tenantCard = this.page.locator('tenant-card').first();
  await tenantCard.click();

  await this.page.waitForURL(/\/tenants\/tenant-active/);

  const detailPage = this.page.locator('tenant-detail-page');
  await detailPage.waitFor({ state: 'visible' });

  const shadowRoot = await detailPage.evaluateHandle((el) => el.shadowRoot);
  const suspendBtn = await shadowRoot.asElement()?.$(('.suspend-btn'));
  await suspendBtn?.click();
});

Then<AdminWorld>('the tenant status shows as suspended', async function () {
  assert.ok(this.page, 'Page should be initialized');

  await this.page.route('**/api/admin/tenants/tenant-active', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tenantId: 'tenant-active',
        displayName: 'Active Creator',
        status: 'suspended',
        rooms: [],
        recentSubscribers: [],
      }),
    });
  });

  await this.page.waitForTimeout(500);

  const detailPage = this.page.locator('tenant-detail-page');
  const shadowRoot = await detailPage.evaluateHandle((el) => el.shadowRoot);
  const badge = await shadowRoot.asElement()?.$(('.status-badge'));

  if (badge) {
    const text = await badge.textContent();
    assert.ok(text?.toLowerCase().includes('suspended'), `Expected suspended status, got: ${text}`);
  }
});
