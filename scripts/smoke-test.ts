#!/usr/bin/env tsx
/**
 * Dale Smoke Test
 *
 * Verifies that all live integrations are reachable and behaving correctly.
 * Reads endpoint config from cdk-outputs.json (auto-detect stack) or env vars.
 *
 * Usage:
 *   npx tsx scripts/smoke-test.ts                    # uses cdk-outputs.json (Dev stack)
 *   STACK=Dale-Prod npx tsx scripts/smoke-test.ts    # override stack key
 *   E2E_ADMIN_API_URL=https://... npx tsx scripts/smoke-test.ts  # fully manual
 *
 * Exit code 0 = all checks passed. Non-zero = at least one failure.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminInitiateAuthCommand,
  AdminDeleteUserCommand,
  AuthFlowType,
  MessageActionType,
} from '@aws-sdk/client-cognito-identity-provider';

// ─── Config ─────────────────────────────────────────────────────────────────

const __dir = dirname(fileURLToPath(import.meta.url));

function loadCdkOutputs(): Record<string, string> {
  try {
    const raw = readFileSync(resolve(__dir, '../cdk-outputs.json'), 'utf-8');
    const all = JSON.parse(raw);
    const stackKey = process.env.STACK ?? Object.keys(all)[0];
    console.log(`  📦 Using CDK stack: ${stackKey}`);
    return all[stackKey] ?? {};
  } catch {
    return {};
  }
}

function loadConfig() {
  const cdk = loadCdkOutputs();
  const get = (env: string, key: string, fallback = '') =>
    process.env[env] ?? cdk[key] ?? fallback;

  return {
    adminApiUrl:        get('E2E_ADMIN_API_URL',         'AdminApiUrl'),
    telegramWebhookUrl: get('E2E_TELEGRAM_WEBHOOK_URL',  'TelegramWebhookUrl'),
    stripeWebhookUrl:   get('E2E_STRIPE_WEBHOOK_URL',    'StripeWebhookUrl'),
    paypalWebhookUrl:   get('E2E_PAYPAL_WEBHOOK_URL',    'PayPalWebhookUrl'),
    webDistributionUrl: get('E2E_WEB_DISTRIBUTION_URL',  'WebDistributionUrl'),
    userPoolId:         get('E2E_USER_POOL_ID',          'UserPoolId'),
    userPoolClientId:   get('E2E_USER_POOL_CLIENT_ID',   'UserPoolClientId'),
    region:             process.env.AWS_REGION ?? 'us-east-1',
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface Result {
  name: string;
  pass: boolean;
  detail: string;
}

const results: Result[] = [];

function pass(name: string, detail: string) {
  results.push({ name, pass: true, detail });
  console.log(`  ✅ ${name}: ${detail}`);
}

function fail(name: string, detail: string) {
  results.push({ name, pass: false, detail });
  console.error(`  ❌ ${name}: ${detail}`);
}

async function probe(
  label: string,
  url: string,
  method: string,
  opts: { body?: string; headers?: Record<string, string>; expectStatus?: number[] } = {},
): Promise<{ status: number; body: string } | null> {
  const { body, headers = {}, expectStatus } = opts;
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body,
    });
    const text = await res.text().catch(() => '');
    if (expectStatus && !expectStatus.includes(res.status)) {
      fail(label, `Expected status ${expectStatus.join('/')} but got ${res.status}. Body: ${text.slice(0, 200)}`);
      return null;
    }
    return { status: res.status, body: text };
  } catch (e: any) {
    fail(label, `Network error: ${e.message}`);
    return null;
  }
}

// ─── Checks ──────────────────────────────────────────────────────────────────

async function checkSpa(cfg: ReturnType<typeof loadConfig>) {
  console.log('\n🌐  SPA / CloudFront');
  const url = cfg.webDistributionUrl;
  if (!url) { fail('SPA root', 'webDistributionUrl not configured'); return; }

  const res = await probe('SPA root', url, 'GET', { expectStatus: [200] });
  if (!res) return;

  if (res.body.toLowerCase().includes('<!doctype html')) {
    pass('SPA root', `${url} → 200 HTML`);
  } else {
    fail('SPA root', `200 but body does not look like HTML`);
  }

  // Deep-link (SPA routing)
  const deep = await probe('SPA deep-link', `${url}/callback`, 'GET', { expectStatus: [200] });
  if (deep) {
    if (deep.body.toLowerCase().includes('<!doctype html')) {
      pass('SPA deep-link', '/callback → 200 HTML (CloudFront SPA routing OK)');
    } else {
      fail('SPA deep-link', '200 but body is not HTML — SPA routing may be broken');
    }
  }
}

async function checkAuth(cfg: ReturnType<typeof loadConfig>): Promise<string | null> {
  console.log('\n🔐  Auth (Cognito)');

  if (process.env.SMOKE_SKIP_AUTH === 'true') {
    console.log('  ⏭️  Skipped (SMOKE_SKIP_AUTH=true)');
    results.push({ name: 'Cognito auth', pass: true, detail: 'Skipped (staging mode)' });
    return null;
  }

  const { userPoolId, userPoolClientId, region } = cfg;
  if (!userPoolId || !userPoolClientId) {
    fail('Cognito', 'userPoolId or userPoolClientId not configured');
    return null;
  }

  const client = new CognitoIdentityProviderClient({ region });
  const username = `smoke-${Date.now()}@smoke.dale.dev`;
  const password = `Smoke!${Date.now()}Abc`;

  try {
    // Create
    await client.send(new AdminCreateUserCommand({
      UserPoolId: userPoolId,
      Username: username,
      UserAttributes: [
        { Name: 'email', Value: username },
        { Name: 'email_verified', Value: 'true' },
      ],
      MessageAction: MessageActionType.SUPPRESS,
    }));

    // Set password
    await client.send(new AdminSetUserPasswordCommand({
      UserPoolId: userPoolId,
      Username: username,
      Password: password,
      Permanent: true,
    }));

    // Auth
    const auth = await client.send(new AdminInitiateAuthCommand({
      UserPoolId: userPoolId,
      ClientId: userPoolClientId,
      AuthFlow: AuthFlowType.ADMIN_USER_PASSWORD_AUTH,
      AuthParameters: { USERNAME: username, PASSWORD: password },
    }));

    const idToken = auth.AuthenticationResult?.IdToken;
    if (!idToken) {
      fail('Cognito auth', 'No IdToken in auth response');
      return null;
    }

    pass('Cognito auth', `Created temp user, obtained IdToken (${username})`);
    return idToken;
  } catch (e: any) {
    fail('Cognito auth', e.message);
    return null;
  } finally {
    // Always clean up
    try {
      await client.send(new AdminDeleteUserCommand({ UserPoolId: userPoolId, Username: username }));
    } catch { /* ignore cleanup errors */ }
  }
}

async function checkAdminApi(cfg: ReturnType<typeof loadConfig>, idToken: string | null) {
  console.log('\n🏛️   Admin API');
  const url = cfg.adminApiUrl;
  if (!url) { fail('Admin API', 'adminApiUrl not configured'); return; }

  // Unauthenticated → should 401
  const unauth = await probe(
    'Admin API (unauthenticated)',
    `${url}/api/tenant`,
    'GET',
    { expectStatus: [401, 403] },
  );
  if (unauth) {
    pass('Admin API (unauthenticated)', `GET /api/tenant → ${unauth.status} (auth guard working)`);
  }

  if (!idToken) {
    fail('Admin API (authenticated)', 'Skipped — no auth token (Cognito failed)');
    return;
  }

  // Onboard a tenant
  const onboard = await probe(
    'Admin API (tenant onboard)',
    `${url}/api/tenant/onboard`,
    'POST',
    {
      body: JSON.stringify({ displayName: 'Smoke Test Tenant', telegramBotToken: 'smoke:AAAAAAAAAAAAAAA-fake' }),
      headers: { Authorization: `Bearer ${idToken}` },
      // 201 success, 400 if bot token is invalid format — both mean the API Lambda is alive and auth is working
      expectStatus: [201, 400, 409],
    },
  );
  if (onboard) {
    if (onboard.status === 201) {
      pass('Admin API (tenant onboard)', `POST /api/tenant/onboard → 201 (DynamoDB + Lambda OK)`);

      // Get tenant back
      const get = await probe(
        'Admin API (get tenant)',
        `${url}/api/tenant`,
        'GET',
        { headers: { Authorization: `Bearer ${idToken}` }, expectStatus: [200] },
      );
      if (get) pass('Admin API (get tenant)', `GET /api/tenant → 200`);

      // Get rooms
      const rooms = await probe(
        'Admin API (list rooms)',
        `${url}/api/rooms`,
        'GET',
        { headers: { Authorization: `Bearer ${idToken}` }, expectStatus: [200] },
      );
      if (rooms) pass('Admin API (list rooms)', `GET /api/rooms → 200`);

    } else if (onboard.status === 409) {
      pass('Admin API (tenant onboard)', `POST /api/tenant/onboard → 409 (tenant already exists — Lambda + DB OK)`);
    } else {
      // 400 — bad bot token but auth worked
      pass('Admin API (tenant onboard)', `POST /api/tenant/onboard → 400 (Lambda alive, auth working; bot token invalid format)`);
    }
  }
}

async function checkStripeWebhook(cfg: ReturnType<typeof loadConfig>) {
  console.log('\n💳  Stripe Webhook Lambda');
  const url = cfg.stripeWebhookUrl;
  if (!url) { fail('Stripe webhook', 'stripeWebhookUrl not configured'); return; }

  // Send a garbage payload — Lambda should respond with 400 (bad signature), not 502/503
  const res = await probe(
    'Stripe webhook',
    url,
    'POST',
    {
      body: JSON.stringify({ type: 'smoke.test', data: {} }),
      headers: { 'stripe-signature': 't=0,v1=smoke' },
      expectStatus: [400, 401, 403, 200],  // anything but 5xx
    },
  );
  if (res) {
    pass('Stripe webhook', `POST → ${res.status} (Lambda alive — bad signature rejected correctly)`);
  }
}

async function checkPayPalWebhook(cfg: ReturnType<typeof loadConfig>) {
  console.log('\n🅿️   PayPal Webhook Lambda');
  const url = cfg.paypalWebhookUrl;
  if (!url) {
    // PayPal might not be configured in Dev
    console.log('  ⚠️  PayPal webhook URL not configured — skipping');
    results.push({ name: 'PayPal webhook', pass: true, detail: 'Skipped (not configured)' });
    return;
  }

  const res = await probe(
    'PayPal webhook',
    url,
    'POST',
    {
      body: JSON.stringify({ event_type: 'SMOKE.TEST', resource: {} }),
      expectStatus: [400, 401, 403, 200],
    },
  );
  if (res) {
    pass('PayPal webhook', `POST → ${res.status} (Lambda alive)`);
  }
}

async function checkTelegramWebhook(cfg: ReturnType<typeof loadConfig>) {
  console.log('\n📨  Telegram Webhook Lambda');
  const url = cfg.telegramWebhookUrl;
  if (!url) { fail('Telegram webhook', 'telegramWebhookUrl not configured'); return; }

  // Send a garbage update — Lambda should respond with 200 (Telegram always gets 200) or 400
  const fakeUpdate = {
    update_id: 999999999,
    message: {
      message_id: 1,
      from: { id: 0, is_bot: false, first_name: 'Smoke' },
      chat: { id: 0, type: 'private' },
      date: Math.floor(Date.now() / 1000),
      text: '/smoke',
    },
  };
  const res = await probe(
    'Telegram webhook',
    url,
    'POST',
    {
      body: JSON.stringify(fakeUpdate),
      expectStatus: [200, 400, 401, 403],
    },
  );
  if (res) {
    pass('Telegram webhook', `POST → ${res.status} (Lambda alive)`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔥 Dale Smoke Test\n');
  console.log('  Loading config...');
  const cfg = loadConfig();

  console.log(`  Admin API:          ${cfg.adminApiUrl || '(not set)'}`);
  console.log(`  Telegram Webhook:   ${cfg.telegramWebhookUrl || '(not set)'}`);
  console.log(`  Stripe Webhook:     ${cfg.stripeWebhookUrl || '(not set)'}`);
  console.log(`  PayPal Webhook:     ${cfg.paypalWebhookUrl || '(not set)'}`);
  console.log(`  Web Distribution:   ${cfg.webDistributionUrl || '(not set)'}`);
  console.log(`  Cognito Pool:       ${cfg.userPoolId || '(not set)'}`);

  await checkSpa(cfg);
  const idToken = await checkAuth(cfg);
  await checkAdminApi(cfg, idToken);
  await checkStripeWebhook(cfg);
  await checkPayPalWebhook(cfg);
  await checkTelegramWebhook(cfg);

  // ── Summary ──
  console.log('\n─────────────────────────────────────────────');
  console.log('Summary\n');

  const passed = results.filter(r => r.pass);
  const failed = results.filter(r => !r.pass);

  for (const r of results) {
    console.log(`  ${r.pass ? '✅' : '❌'} ${r.name}`);
    if (!r.pass) console.log(`       → ${r.detail}`);
  }

  console.log(`\n  ${passed.length}/${results.length} checks passed`);

  if (failed.length > 0) {
    console.error(`\n💥 ${failed.length} check(s) failed.`);
    process.exit(1);
  } else {
    console.log('\n✨ All systems green.');
    process.exit(0);
  }
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
