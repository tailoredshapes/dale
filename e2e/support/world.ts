import { World, setWorldConstructor } from '@cucumber/cucumber';
import { E2EConfig, loadConfig } from '../env.js';
import { HttpResponse } from './http.js';
import type { Browser, BrowserContext, Page } from 'playwright';
import type { TelegramClient } from 'telegram';
import type { BigInteger } from 'big-integer';

export class DaleWorld extends World {
  config: E2EConfig;

  // Auth state
  idToken?: string;
  accessToken?: string;
  refreshToken?: string;
  cognitoUsername?: string;
  srpPassword?: string;

  // Response state
  lastResponse?: HttpResponse;

  // Entity state for multi-step scenarios
  lastRoomId?: string;

  // Telegram simulation state
  webhookSecret?: string;
  telegramGroupId?: number;

  // GramJS state (real Telegram scenarios)
  telegramClient?: TelegramClient;
  telegramRealChatId?: BigInteger;
  botReply?: string;

  // Browser state (tutorial scenarios)
  browser?: Browser;
  context?: BrowserContext;
  page?: Page;

  // Cleanup registries
  tenantIds: string[] = [];
  webhookSecrets: string[] = [];

  // Multi-tenant support
  secondTenantId?: string;
  secondTenantToken?: string;
  secondTenantWebhookSecret?: string;
  tenantAWebhookSecret?: string;
  tenantARoomId?: string;
  tenantBRoomId?: string;

  // Stripe/PayPal subscription tracking
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  paypalPayerId?: string;
  paypalSubscriptionId?: string;

  // Multi-room support
  roomA?: { roomId: string; telegramGroupId: number; stripeSubscriptionId?: string };
  roomB?: { roomId: string; telegramGroupId: number; stripeSubscriptionId?: string };

  // Stored values for comparisons
  storedValues: Record<string, string> = {};

  constructor(options: any) {
    super(options);
    this.config = loadConfig();
  }
}

setWorldConstructor(DaleWorld);
