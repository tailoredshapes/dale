/**
 * Step definitions for exhaustive admin room management scenarios
 */
import { When, Then, DataTable } from '@cucumber/cucumber';
import { DaleWorld } from '../support/world.js';
import { apiRequest } from '../support/http.js';
import assert from 'node:assert/strict';

// ============== When Steps ==============

When<DaleWorld>('I create a room with:', async function (dataTable: DataTable) {
  assert.ok(this.idToken, 'No auth token available');

  const rows = dataTable.rowsHash();
  const body: Record<string, any> = {};

  for (const [key, value] of Object.entries(rows)) {
    body[key] = value;
  }

  this.lastResponse = await apiRequest(
    `${this.config.adminApiUrl}/api/rooms`,
    'POST',
    {
      token: this.idToken,
      body,
    },
  );

  // Track room for cleanup
  if (this.lastResponse.status === 201 && this.lastResponse.body?.roomId) {
    this.lastRoomId = this.lastResponse.body.roomId;
  }
});

When<DaleWorld>(
  'I update the room with paymentLink {string}',
  async function (paymentLink: string) {
    assert.ok(this.idToken, 'No auth token available');
    assert.ok(this.lastRoomId, 'No room has been created');

    this.lastResponse = await apiRequest(
      `${this.config.adminApiUrl}/api/rooms/${this.lastRoomId}`,
      'PUT',
      {
        token: this.idToken,
        body: { paymentLink, isActive: true },
      },
    );
  },
);

When<DaleWorld>(
  'I send an unauthenticated PUT request to the created room with body:',
  async function (body: string) {
    assert.ok(this.lastRoomId, 'No room has been created');

    this.lastResponse = await apiRequest(
      `${this.config.adminApiUrl}/api/rooms/${this.lastRoomId}`,
      'PUT',
      {
        body: JSON.parse(body),
      },
    );
  },
);

When<DaleWorld>('I delete the room', async function () {
  assert.ok(this.idToken, 'No auth token available');
  assert.ok(this.lastRoomId, 'No room has been created');

  this.lastResponse = await apiRequest(
    `${this.config.adminApiUrl}/api/rooms/${this.lastRoomId}`,
    'DELETE',
    { token: this.idToken },
  );
});

// ============== Then Steps ==============

Then<DaleWorld>(
  'the response body should have field {string} with value {string}',
  function (field: string, expectedValue: string) {
    assert.ok(this.lastResponse, 'No response recorded');
    assert.ok(
      typeof this.lastResponse.body === 'object',
      `Expected body to be an object, got: ${typeof this.lastResponse.body}`,
    );
    assert.equal(
      this.lastResponse.body[field],
      expectedValue,
      `Expected ${field} to be "${expectedValue}", got "${this.lastResponse.body[field]}"`,
    );
  },
);

Then<DaleWorld>('the room should be active', function () {
  assert.ok(this.lastResponse, 'No response recorded');
  assert.ok(
    typeof this.lastResponse.body === 'object',
    'Expected body to be an object',
  );
  assert.equal(
    this.lastResponse.body.isActive,
    true,
    `Expected room to be active, got isActive=${this.lastResponse.body.isActive}`,
  );
});

// Note: "there should be {int} room(s)" is defined in telegram-group.steps.ts
