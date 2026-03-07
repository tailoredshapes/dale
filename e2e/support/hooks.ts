import { Before, After } from '@cucumber/cucumber';
import { chromium } from 'playwright';
import { DaleWorld } from './world.js';
import { createTestUser, deleteTestUser } from './auth.js';
import { createLocalTestUser, deleteLocalTestUser } from './local-auth.js';
import { cleanupDynamoDBTenant, cleanupSSMParams, cleanupWebhookSecret } from './cleanup.js';
import { createTelegramClient, deleteGroup } from './gramjs.js';

Before<DaleWorld>({ tags: '@auth' }, async function () {
  if (this.config.localMode) {
    const user = await createLocalTestUser(this.config.adminApiUrl);
    this.idToken = user.idToken;
    this.accessToken = user.accessToken;
    this.refreshToken = user.refreshToken;
    this.cognitoUsername = user.username;
  } else {
    const user = await createTestUser(
      this.config.userPoolId,
      this.config.userPoolClientId,
    );
    this.idToken = user.idToken;
    this.accessToken = user.accessToken;
    this.refreshToken = user.refreshToken;
    this.cognitoUsername = user.username;
  }
});

Before<DaleWorld>({ tags: '@real-telegram' }, async function () {
  const { telegramApiId, telegramApiHash, telegramTestSession, telegramTestBotToken, telegramTestBotUsername } = this.config;
  if (!telegramApiId || !telegramApiHash || !telegramTestSession || !telegramTestBotToken || !telegramTestBotUsername) {
    return 'skipped';
  }
  this.telegramClient = await createTelegramClient(this.config);
});

After<DaleWorld>({ tags: '@real-telegram' }, async function () {
  if (this.telegramClient && this.telegramRealChatId) {
    await deleteGroup(this.telegramClient, this.telegramRealChatId);
    this.telegramRealChatId = undefined;
  }
  if (this.telegramClient) {
    await this.telegramClient.disconnect();
    this.telegramClient = undefined;
  }
});

Before<DaleWorld>({ tags: '@tutorial' }, async function () {
  this.browser = await chromium.launch({ headless: true });
  this.context = await this.browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  });
  this.page = await this.context.newPage();

  // Log failed requests for debugging
  this.page.on('requestfailed', (req) => {
    console.log(`[request FAILED] ${req.method()} ${req.url()} - ${req.failure()?.errorText}`);
  });
});

After<DaleWorld>({ tags: '@tutorial' }, async function () {
  if (this.browser) {
    await this.browser.close();
    this.browser = undefined;
    this.context = undefined;
    this.page = undefined;
  }
});

After<DaleWorld>(async function () {
  // Clean up tenants from DynamoDB and SSM
  for (const tenantId of this.tenantIds) {
    await cleanupDynamoDBTenant(this.config, tenantId);
    await cleanupSSMParams(this.config, tenantId);
  }

  // Clean up webhook secrets
  for (const secret of this.webhookSecrets) {
    await cleanupWebhookSecret(this.config, secret);
  }

  // Clean up Cognito user
  if (this.cognitoUsername) {
    if (this.config.localMode) {
      await deleteLocalTestUser(this.config.adminApiUrl, this.cognitoUsername);
    } else {
      await deleteTestUser(this.config.userPoolId, this.cognitoUsername);
    }
  }
});
