import type { PlatformConfig } from './types.js';

let cachedConfig: PlatformConfig | null = null;

export function getPlatformConfig(): PlatformConfig {
  if (cachedConfig) return cachedConfig;

  const meshqlUrl = process.env.MESHQL_URL ?? 'http://localhost:8080';

  const telegramWebhookUrl = process.env.TELEGRAM_WEBHOOK_URL ?? '';
  const stripeWebhookUrl = process.env.STRIPE_WEBHOOK_URL ?? '';
  const paypalWebhookUrl = process.env.PAYPAL_WEBHOOK_URL ?? '';
  const paypalBaseUrl = process.env.PAYPAL_BASE_URL ?? 'https://api-m.paypal.com';

  cachedConfig = { meshqlUrl, telegramWebhookUrl, stripeWebhookUrl, paypalWebhookUrl, paypalBaseUrl };
  return cachedConfig;
}

export function resetConfigCache(): void {
  cachedConfig = null;
}
