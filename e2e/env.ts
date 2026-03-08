import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

export interface E2EConfig {
  adminApiUrl: string;
  telegramWebhookUrl: string;
  stripeWebhookUrl: string;
  paypalWebhookUrl: string;
  telegramMockUrl: string;
  userPoolId: string;
  userPoolClientId: string;
  webDistributionUrl: string;
  region: string;

  // Local mode flag
  localMode: boolean;

  // Optional: Telegram test DC config for @real-telegram scenarios
  telegramApiId?: number;
  telegramApiHash?: string;
  telegramTestSession?: string;
  telegramTestBotToken?: string;
  telegramTestBotUsername?: string;
}

function getDir(): string {
  try {
    return dirname(fileURLToPath(import.meta.url));
  } catch {
    return __dirname;
  }
}

function loadCdkOutputs(): Record<string, string> {
  try {
    const raw = readFileSync(resolve(getDir(), '../cdk-outputs.json'), 'utf-8');
    const outputs = JSON.parse(raw);
    const stackKey = Object.keys(outputs)[0];
    return outputs[stackKey] ?? {};
  } catch {
    return {};
  }
}

export function loadConfig(): E2EConfig {
  const localMode = process.env.E2E_LOCAL_MODE === 'true';

  if (localMode) {
    return loadLocalConfig();
  }

  const cdkOutputs = loadCdkOutputs();

  function get(envVar: string, cdkKey: string): string {
    const value = process.env[envVar] ?? cdkOutputs[cdkKey];
    if (!value) {
      throw new Error(`Missing config: set ${envVar} or ensure ${cdkKey} exists in cdk-outputs.json`);
    }
    return value;
  }

  const apiId = process.env.E2E_TELEGRAM_API_ID;

  return {
    localMode: false,
    adminApiUrl: get('E2E_ADMIN_API_URL', 'AdminApiUrl'),
    telegramWebhookUrl: get('E2E_TELEGRAM_WEBHOOK_URL', 'TelegramWebhookUrl'),
    stripeWebhookUrl: get('E2E_STRIPE_WEBHOOK_URL', 'StripeWebhookUrl'),
    paypalWebhookUrl: process.env.E2E_PAYPAL_WEBHOOK_URL ?? cdkOutputs['PayPalWebhookUrl'] ?? '',
    telegramMockUrl: process.env.E2E_TELEGRAM_MOCK_URL ?? '',
    userPoolId: get('E2E_USER_POOL_ID', 'UserPoolId'),
    userPoolClientId: get('E2E_USER_POOL_CLIENT_ID', 'UserPoolClientId'),
    webDistributionUrl: get('E2E_WEB_DISTRIBUTION_URL', 'WebDistributionUrl'),
    region: process.env.E2E_REGION ?? process.env.AWS_REGION ?? 'us-east-1',

    telegramApiId: apiId ? parseInt(apiId, 10) : undefined,
    telegramApiHash: process.env.E2E_TELEGRAM_API_HASH,
    telegramTestSession: process.env.E2E_TELEGRAM_TEST_SESSION,
    telegramTestBotToken: process.env.E2E_TELEGRAM_TEST_BOT_TOKEN,
    telegramTestBotUsername: process.env.E2E_TELEGRAM_TEST_BOT_USERNAME,
  };
}

function loadLocalConfig(): E2EConfig {
  const host = process.env.E2E_LOCAL_HOST ?? 'localhost';
  const apiId = process.env.E2E_TELEGRAM_API_ID;

  return {
    localMode: true,
    adminApiUrl: process.env.E2E_ADMIN_API_URL ?? `http://${host}:3000`,
    telegramWebhookUrl: process.env.E2E_TELEGRAM_WEBHOOK_URL ?? `http://${host}:3001`,
    stripeWebhookUrl: process.env.E2E_STRIPE_WEBHOOK_URL ?? `http://${host}:3002`,
    paypalWebhookUrl: process.env.E2E_PAYPAL_WEBHOOK_URL ?? `http://${host}:3003`,
    telegramMockUrl: process.env.E2E_TELEGRAM_MOCK_URL ?? `http://${host}:3004`,
    userPoolId: 'local-pool',
    userPoolClientId: 'local-client',
    webDistributionUrl: `http://${host}:5173`,
    region: 'us-east-1',

    telegramApiId: apiId ? parseInt(apiId, 10) : undefined,
    telegramApiHash: process.env.E2E_TELEGRAM_API_HASH,
    telegramTestSession: process.env.E2E_TELEGRAM_TEST_SESSION,
    telegramTestBotToken: process.env.E2E_TELEGRAM_TEST_BOT_TOKEN,
    telegramTestBotUsername: process.env.E2E_TELEGRAM_TEST_BOT_USERNAME,
  };
}
