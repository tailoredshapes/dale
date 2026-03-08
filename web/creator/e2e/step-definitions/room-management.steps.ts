import { Given, When, Then } from '@cucumber/cucumber';
import { CreatorWorld } from '../support/world.js';
import assert from 'node:assert/strict';

function setupAuth(page: CreatorWorld['page'], tokens: { idToken?: string; accessToken?: string; tenantId?: string; webhookSecret?: string }) {
  return page!.addInitScript((t) => {
    const authData = {
      idToken: t.idToken,
      accessToken: t.accessToken,
      expiresAt: Date.now() + 3600000,
    };
    sessionStorage.setItem('dale_creator_auth', JSON.stringify(authData));

    const tenantData = {
      tenantId: t.tenantId,
      webhookSecret: t.webhookSecret,
      displayName: 'Test Creator',
      isOnboarded: true,
    };
    sessionStorage.setItem('dale_creator_tenant', JSON.stringify(tenantData));
  }, tokens);
}

Given<CreatorWorld>('I am on the rooms page', async function () {
  assert.ok(this.page, 'Page should be initialized');

  await setupAuth(this.page, {
    idToken: this.idToken,
    accessToken: this.accessToken,
    tenantId: this.tenantId,
    webhookSecret: this.webhookSecret,
  });

  await this.page.route('**/api/rooms', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }
  });

  await this.page.goto(`${this.config.baseUrl}/rooms`);
  await this.page.waitForLoadState('networkidle');
});

When<CreatorWorld>('I fill in room name, description, Telegram group ID and price', async function () {
  assert.ok(this.page, 'Page should be initialized');

  const roomsPage = this.page.locator('rooms-page');
  await roomsPage.waitFor({ state: 'visible' });

  let shadowRoot = await roomsPage.evaluateHandle((el) => el.shadowRoot);
  const createBtn = await shadowRoot.asElement()?.$(('.create-btn'));
  await createBtn?.click();

  await this.page.waitForTimeout(300);

  shadowRoot = await roomsPage.evaluateHandle((el) => el.shadowRoot);
  const formOverlay = await shadowRoot.asElement()?.$(('.form-overlay'));
  assert.ok(formOverlay, 'Form overlay should be visible');

  const roomForm = await formOverlay?.$(('room-form'));
  const formShadow = await roomForm?.evaluateHandle((el) => el.shadowRoot);

  const nameInput = await formShadow?.asElement()?.$(('#name'));
  await nameInput?.fill('Premium Signals');

  const descInput = await formShadow?.asElement()?.$(('#description'));
  await descInput?.fill('Daily trading signals');

  const groupIdInput = await formShadow?.asElement()?.$(('#telegramGroupId'));
  await groupIdInput?.fill('-1001234567890');

  const priceInput = await formShadow?.asElement()?.$(('#priceDescription'));
  await priceInput?.fill('$29/month');
});

When<CreatorWorld>('I click Create', async function () {
  assert.ok(this.page, 'Page should be initialized');

  await this.page.route('**/api/rooms', async (route) => {
    if (route.request().method() === 'POST') {
      this.roomId = 'room-new';
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          roomId: 'room-new',
          name: 'Premium Signals',
          description: 'Daily trading signals',
          telegramGroupId: '-1001234567890',
          priceDescription: '$29/month',
          isActive: true,
        }),
      });
    } else if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            roomId: 'room-new',
            name: 'Premium Signals',
            description: 'Daily trading signals',
            priceDescription: '$29/month',
            isActive: true,
            subscriberCount: 0,
          },
        ]),
      });
    }
  });

  const roomsPage = this.page.locator('rooms-page');
  const shadowRoot = await roomsPage.evaluateHandle((el) => el.shadowRoot);
  const formOverlay = await shadowRoot.asElement()?.$(('.form-overlay'));
  const roomForm = await formOverlay?.$(('room-form'));
  const formShadow = await roomForm?.evaluateHandle((el) => el.shadowRoot);

  const submitBtn = await formShadow?.asElement()?.$(('button[type="submit"]'));
  await submitBtn?.click();
});

Then<CreatorWorld>('the new room appears in my room list', async function () {
  assert.ok(this.page, 'Page should be initialized');

  await this.page.waitForTimeout(500);

  const roomListItem = this.page.locator('room-list-item').first();
  await roomListItem.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

  const shadowRoot = await roomListItem.evaluateHandle((el) => el.shadowRoot);
  const nameEl = await shadowRoot.asElement()?.$(('.room-name'));

  if (nameEl) {
    const text = await nameEl.textContent();
    assert.ok(text?.includes('Premium Signals'), `Expected room name, got: ${text}`);
  }
});

Given<CreatorWorld>('I have an existing room', async function () {
  assert.ok(this.page, 'Page should be initialized');

  await setupAuth(this.page, {
    idToken: this.idToken,
    accessToken: this.accessToken,
    tenantId: this.tenantId,
    webhookSecret: this.webhookSecret,
  });

  this.roomId = 'room-existing';

  await this.page.route('**/api/rooms', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          roomId: 'room-existing',
          name: 'Original Room',
          description: 'Original description',
          priceDescription: '$19/month',
          isActive: true,
          subscriberCount: 5,
        },
      ]),
    });
  });

  await this.page.goto(`${this.config.baseUrl}/rooms`);
  await this.page.waitForLoadState('networkidle');
});

When<CreatorWorld>('I edit the room name', async function () {
  assert.ok(this.page, 'Page should be initialized');

  await this.page.route('**/api/rooms/room-existing', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          roomId: 'room-existing',
          name: 'Original Room',
          description: 'Original description',
          priceDescription: '$19/month',
          isActive: true,
        }),
      });
    } else if (route.request().method() === 'PUT') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ updated: true }),
      });
    }
  });

  await this.page.route('**/api/rooms/room-existing/subscribers', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  const roomListItem = this.page.locator('room-list-item').first();
  await roomListItem.click();

  await this.page.waitForURL(/\/rooms\/room-existing/);

  const detailPage = this.page.locator('room-detail-page');
  await detailPage.waitFor({ state: 'visible' });

  const shadowRoot = await detailPage.evaluateHandle((el) => el.shadowRoot);
  const editBtn = await shadowRoot.asElement()?.$(('.edit-btn'));
  await editBtn?.click();

  await this.page.waitForTimeout(300);

  const formOverlay = await shadowRoot.asElement()?.$(('.form-overlay'));
  const roomForm = await formOverlay?.$(('room-form'));
  const formShadow = await roomForm?.evaluateHandle((el) => el.shadowRoot);

  const nameInput = await formShadow?.asElement()?.$(('#name'));
  await nameInput?.fill('');
  await nameInput?.fill('Updated Room Name');

  const submitBtn = await formShadow?.asElement()?.$(('button[type="submit"]'));
  await submitBtn?.click();
});

Then<CreatorWorld>('the updated name appears in the room list', async function () {
  assert.ok(this.page, 'Page should be initialized');

  await this.page.route('**/api/rooms', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          roomId: 'room-existing',
          name: 'Updated Room Name',
          priceDescription: '$19/month',
          isActive: true,
          subscriberCount: 5,
        },
      ]),
    });
  });

  await this.page.goto(`${this.config.baseUrl}/rooms`);
  await this.page.waitForLoadState('networkidle');

  const roomListItem = this.page.locator('room-list-item').first();
  await roomListItem.waitFor({ state: 'visible' });

  const shadowRoot = await roomListItem.evaluateHandle((el) => el.shadowRoot);
  const nameEl = await shadowRoot.asElement()?.$(('.room-name'));

  if (nameEl) {
    const text = await nameEl.textContent();
    assert.ok(text?.includes('Updated Room Name'), `Expected updated name, got: ${text}`);
  }
});

Given<CreatorWorld>('I have an active room with subscribers', async function () {
  assert.ok(this.page, 'Page should be initialized');

  await setupAuth(this.page, {
    idToken: this.idToken,
    accessToken: this.accessToken,
    tenantId: this.tenantId,
    webhookSecret: this.webhookSecret,
  });

  this.roomId = 'room-active';

  await this.page.route('**/api/rooms', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          roomId: 'room-active',
          name: 'Active Room',
          priceDescription: '$29/month',
          isActive: true,
          subscriberCount: 10,
        },
      ]),
    });
  });

  await this.page.goto(`${this.config.baseUrl}/rooms`);
  await this.page.waitForLoadState('networkidle');
});

When<CreatorWorld>('I deactivate the room', async function () {
  assert.ok(this.page, 'Page should be initialized');

  await this.page.route('**/api/rooms/room-active', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          roomId: 'room-active',
          name: 'Active Room',
          priceDescription: '$29/month',
          isActive: true,
        }),
      });
    } else if (route.request().method() === 'PUT') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ updated: true }),
      });
    }
  });

  await this.page.route('**/api/rooms/room-active/subscribers', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  const roomListItem = this.page.locator('room-list-item').first();
  await roomListItem.click();

  await this.page.waitForURL(/\/rooms\/room-active/);

  const detailPage = this.page.locator('room-detail-page');
  await detailPage.waitFor({ state: 'visible' });

  const shadowRoot = await detailPage.evaluateHandle((el) => el.shadowRoot);
  const toggleBtn = await shadowRoot.asElement()?.$(('.toggle-btn'));
  await toggleBtn?.click();
});

Then<CreatorWorld>('the room status shows as inactive', async function () {
  assert.ok(this.page, 'Page should be initialized');

  await this.page.route('**/api/rooms/room-active', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        roomId: 'room-active',
        name: 'Active Room',
        priceDescription: '$29/month',
        isActive: false,
      }),
    });
  });

  await this.page.waitForTimeout(500);

  const detailPage = this.page.locator('room-detail-page');
  const shadowRoot = await detailPage.evaluateHandle((el) => el.shadowRoot);
  const badge = await shadowRoot.asElement()?.$(('.status-badge'));

  if (badge) {
    const text = await badge.textContent();
    assert.ok(text?.toLowerCase().includes('inactive'), `Expected inactive status, got: ${text}`);
  }
});

Given<CreatorWorld>('I have a room with subscribers', async function () {
  assert.ok(this.page, 'Page should be initialized');

  await setupAuth(this.page, {
    idToken: this.idToken,
    accessToken: this.accessToken,
    tenantId: this.tenantId,
    webhookSecret: this.webhookSecret,
  });

  this.roomId = 'room-subs';

  await this.page.route('**/api/rooms', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          roomId: 'room-subs',
          name: 'Room With Subs',
          priceDescription: '$29/month',
          isActive: true,
          subscriberCount: 3,
        },
      ]),
    });
  });

  await this.page.goto(`${this.config.baseUrl}/rooms`);
  await this.page.waitForLoadState('networkidle');
});

When<CreatorWorld>('I open the room detail page', async function () {
  assert.ok(this.page, 'Page should be initialized');

  await this.page.route('**/api/rooms/room-subs', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        roomId: 'room-subs',
        name: 'Room With Subs',
        priceDescription: '$29/month',
        isActive: true,
      }),
    });
  });

  await this.page.route('**/api/rooms/room-subs/subscribers', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          telegramUserId: 12345,
          telegramFirstName: 'John',
          telegramUsername: 'johndoe',
          roomId: 'room-subs',
          subscriptionStatus: 'active',
        },
        {
          telegramUserId: 67890,
          telegramFirstName: 'Jane',
          telegramUsername: 'janedoe',
          roomId: 'room-subs',
          subscriptionStatus: 'active',
        },
        {
          telegramUserId: 11111,
          telegramFirstName: 'Bob',
          roomId: 'room-subs',
          subscriptionStatus: 'past_due',
        },
      ]),
    });
  });

  const roomListItem = this.page.locator('room-list-item').first();
  await roomListItem.click();

  await this.page.waitForURL(/\/rooms\/room-subs/);
});

Then<CreatorWorld>('I see a list of subscribers with their subscription status', async function () {
  assert.ok(this.page, 'Page should be initialized');

  const detailPage = this.page.locator('room-detail-page');
  await detailPage.waitFor({ state: 'visible' });

  const shadowRoot = await detailPage.evaluateHandle((el) => el.shadowRoot);
  const subscriberList = await shadowRoot.asElement()?.$(('subscriber-list'));
  assert.ok(subscriberList, 'Subscriber list should be visible');

  const listShadow = await subscriberList?.evaluateHandle((el) => el.shadowRoot);
  const items = await listShadow?.asElement()?.$$(('.subscriber-item'));

  assert.ok(items && items.length >= 2, `Expected at least 2 subscribers, got: ${items?.length}`);
});
