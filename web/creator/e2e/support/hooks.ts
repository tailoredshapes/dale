import { Before, After, BeforeAll, AfterAll } from '@cucumber/cucumber';
import { chromium, Browser } from 'playwright';
import { CreatorWorld } from './world.js';

let browser: Browser;

BeforeAll(async function () {
  browser = await chromium.launch({
    headless: process.env.E2E_HEADLESS !== 'false',
  });
});

AfterAll(async function () {
  if (browser) {
    await browser.close();
  }
});

Before(async function (this: CreatorWorld) {
  this.browser = browser;
  this.context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  this.page = await this.context.newPage();
});

After(async function (this: CreatorWorld) {
  if (this.page) {
    await this.page.close();
  }
  if (this.context) {
    await this.context.close();
  }
});

Before({ tags: '@auth' }, async function (this: CreatorWorld) {
  this.idToken = 'mock-id-token';
  this.accessToken = 'mock-access-token';
  this.tenantId = 'tenant-test';
  this.webhookSecret = 'webhook-secret-test';
});
