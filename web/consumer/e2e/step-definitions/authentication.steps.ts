import { Given, When, Then } from '@cucumber/cucumber';
import { ConsumerWorld } from '../support/world.js';
import assert from 'node:assert/strict';

When<ConsumerWorld>('I click {string}', async function (buttonText: string) {
  assert.ok(this.page, 'Page should be initialized');

  const header = this.page.locator('dale-header');
  await header.waitFor({ state: 'visible' });

  const shadowRoot = await header.evaluateHandle((el) => el.shadowRoot);
  const button = await shadowRoot.asElement()?.$((`button:has-text("${buttonText}")`));

  if (button) {
    await button.click();
  } else {
    throw new Error(`Button "${buttonText}" not found`);
  }
});

Then<ConsumerWorld>('I am redirected to the Cognito auth page', async function () {
  assert.ok(this.page, 'Page should be initialized');

  await this.page.waitForURL(/oauth2\/authorize|cognito/, { timeout: 5000 }).catch(() => {
    const currentUrl = this.page!.url();
    assert.ok(
      currentUrl.includes('oauth2') || currentUrl.includes('cognito') || currentUrl.includes('auth'),
      `Expected redirect to auth page, got: ${currentUrl}`
    );
  });
});
