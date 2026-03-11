import { When, Then } from '@cucumber/cucumber';
import { DaleWorld } from '../support/world.js';
import assert from 'node:assert/strict';

// Cache the JS bundle URL and content across steps in a scenario
let cachedBundleContent: string | null = null;

When<DaleWorld>('I fetch the SPA JS bundle', async function () {
  if (this.config.localMode) return 'skipped';

  // Fetch index.html to find the JS bundle src
  const indexRes = await fetch(this.config.webDistributionUrl);
  assert.equal(indexRes.status, 200, 'SPA index.html should return 200');
  const html = await indexRes.text();

  const match = html.match(/src="([^"]+\.js)"/);
  assert.ok(match, 'Could not find JS bundle <script src> in index.html');

  const jsUrl = match[1].startsWith('http')
    ? match[1]
    : `${this.config.webDistributionUrl}${match[1]}`;

  const jsRes = await fetch(jsUrl);
  assert.equal(jsRes.status, 200, `JS bundle fetch failed: ${jsUrl}`);
  cachedBundleContent = await jsRes.text();

  this.lastResponse = {
    status: jsRes.status,
    body: cachedBundleContent,
    headers: jsRes.headers,
  };
});

Then<DaleWorld>('the bundle should not contain the string {string}', async function (str: string) {
  if (this.config.localMode) return 'skipped';
  assert.ok(cachedBundleContent, 'No bundle content — run "I fetch the SPA JS bundle" first');
  assert.ok(
    !cachedBundleContent.includes(str),
    `JS bundle contains "${str}" — likely a missing VITE_ env var baked in as a placeholder`,
  );
});

Then<DaleWorld>('the bundle should contain the string {string}', async function (str: string) {
  if (this.config.localMode) return 'skipped';
  assert.ok(cachedBundleContent, 'No bundle content — run "I fetch the SPA JS bundle" first');
  assert.ok(
    cachedBundleContent.includes(str),
    `JS bundle does not contain "${str}" — VITE_API_URL may not be set correctly`,
  );
});

When<DaleWorld>('I request the admin API health endpoint', async function () {
  if (this.config.localMode) return 'skipped';
  // Unauthenticated GET to a known API path — should return JSON (401), not HTML
  const res = await fetch(`${this.config.adminApiUrl}/api/tenant`);
  this.lastResponse = {
    status: res.status,
    body: await res.text(),
    headers: res.headers,
  };
});

Then<DaleWorld>('the response status should be {int} or {int}', async function (a: number, b: number) {
  if (this.config.localMode) return 'skipped';
  assert.ok(
    this.lastResponse?.status === a || this.lastResponse?.status === b,
    `Expected status ${a} or ${b}, got ${this.lastResponse?.status}`,
  );
});

Then<DaleWorld>('the response body should be valid JSON', async function () {
  if (this.config.localMode) return 'skipped';
  try {
    JSON.parse(this.lastResponse?.body as string);
  } catch {
    assert.fail(`Response body is not valid JSON: ${String(this.lastResponse?.body).slice(0, 200)}`);
  }
});

Then<DaleWorld>('the response body should not contain {string}', async function (str: string) {
  if (this.config.localMode) return 'skipped';
  const body = String(this.lastResponse?.body ?? '');
  assert.ok(
    !body.toLowerCase().includes(str.toLowerCase()),
    `Response body contains "${str}" — API may be returning HTML instead of JSON`,
  );
});
