/**
 * Step definitions for exhaustive admin tenant management scenarios
 */
import { Given, When, Then } from '@cucumber/cucumber';
import { DaleWorld } from '../support/world.js';
import { apiRequest } from '../support/http.js';
import { getSSMParameter } from '../support/ssm.js';
import { createLocalTestUser } from '../support/local-auth.js';
import assert from 'node:assert/strict';

// ============== Given Steps ==============

Given<DaleWorld>(
  'I have retrieved the webhook secret as {string}',
  async function (varName: string) {
    assert.ok(this.tenantIds.length > 0, 'No tenant onboarded');
    const tenantId = this.tenantIds[this.tenantIds.length - 1];
    const secret = await getSSMParameter(`/dale/tenants/${tenantId}/telegram-webhook-secret`, this.config);
    this.storedValues[varName] = secret;
    this.webhookSecrets.push(secret);
  },
);

Given<DaleWorld>('I store the tenantId as {string}', function (varName: string) {
  assert.ok(this.tenantIds.length > 0, 'No tenant onboarded');
  const tenantId = this.tenantIds[this.tenantIds.length - 1];
  this.storedValues[varName] = tenantId;
});

// ============== When Steps ==============

When<DaleWorld>(
  'I send an authenticated GET request to {string} without prior onboarding',
  async function (path: string) {
    // Create a new user who has NOT onboarded a tenant
    const user = await createLocalTestUser(this.config.adminApiUrl);

    this.lastResponse = await apiRequest(
      `${this.config.adminApiUrl}${path}`,
      'GET',
      { token: user.idToken },
    );
  },
);

// ============== Then Steps ==============

Then<DaleWorld>(
  '{string} should not equal {string}',
  function (var1: string, var2: string) {
    const value1 = this.storedValues[var1];
    const value2 = this.storedValues[var2];

    assert.ok(value1, `Variable "${var1}" not found in stored values`);
    assert.ok(value2, `Variable "${var2}" not found in stored values`);
    assert.notEqual(value1, value2, `Expected "${var1}" (${value1}) to not equal "${var2}" (${value2})`);
  },
);

Then<DaleWorld>('the response should include CORS headers', function () {
  assert.ok(this.lastResponse, 'No response recorded');

  // Check for standard CORS headers
  const headers = this.lastResponse.headers;
  const corsOrigin = headers.get('access-control-allow-origin');
  const corsMethods = headers.get('access-control-allow-methods');
  const corsHeaders = headers.get('access-control-allow-headers');

  assert.ok(
    corsOrigin,
    'Expected Access-Control-Allow-Origin header to be present',
  );
});

// Note: "the response status should be {int} or {int}" is defined in common.steps.ts
