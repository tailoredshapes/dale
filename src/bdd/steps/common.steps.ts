import { Given, Then } from 'quickpickle';
import { expect } from 'vitest';
import type { DaleWorld } from '../world.js';

// ── Common Givens ────────────────────────────────────────────────────────────

Given('the Dale system is running', async () => {
  // no-op: mocks are the system
});

Given('I have an existing tenant', async () => {
  // Handled by feature-specific setup
});

// ── Common Thens (response assertions) ───────────────────────────────────────

Then('the response status is {int}', async (world: DaleWorld, status: number) => {
  expect(world.response).not.toBeNull();
  expect(world.response!.statusCode).toBe(status);
});

Then('the response contains a {string}', async (world: DaleWorld, key: string) => {
  const body = JSON.parse(world.response!.body);
  expect(body).toHaveProperty(key);
  expect(body[key]).toBeTruthy();
});

Then('the response contains error {string}', async (world: DaleWorld, msg: string) => {
  const body = JSON.parse(world.response!.body);
  expect(body.error).toContain(msg);
});

Then('the response contains {string}: {word}', async (world: DaleWorld, key: string, value: string) => {
  const body = JSON.parse(world.response!.body);
  const expected = value === 'true' ? true : value === 'false' ? false : value;
  expect(body[key]).toBe(expected);
});

Then('the response contains {string}', async (world: DaleWorld, key: string) => {
  const body = JSON.parse(world.response!.body);
  expect(body).toHaveProperty(key);
});
