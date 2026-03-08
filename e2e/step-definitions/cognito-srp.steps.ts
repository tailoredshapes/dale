import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  MessageActionType,
} from '@aws-sdk/client-cognito-identity-provider';
import { DaleWorld } from '../support/world.js';
import { srpAuthenticate } from '../support/srp-auth.js';

// Lazy-initialize Cognito client to avoid CredentialsProviderError when env not set
let cognitoClient: CognitoIdentityProviderClient | null = null;

function getCognitoClient(): CognitoIdentityProviderClient {
  if (!cognitoClient) {
    const region = process.env.AWS_REGION ?? process.env.E2E_REGION ?? 'us-east-1';
    cognitoClient = new CognitoIdentityProviderClient({ region });
  }
  return cognitoClient;
}

Given<DaleWorld>('a temporary user exists for SRP testing', async function () {
  // Skip in local mode - Cognito SRP requires real AWS
  if (this.config.localMode) {
    return 'skipped';
  }

  const username = `e2e-srp-${Date.now()}@test.dale.dev`;
  const password = `SrpTest!${Date.now()}`;

  await getCognitoClient().send(
    new AdminCreateUserCommand({
      UserPoolId: this.config.userPoolId,
      Username: username,
      UserAttributes: [
        { Name: 'email', Value: username },
        { Name: 'email_verified', Value: 'true' },
      ],
      MessageAction: MessageActionType.SUPPRESS,
    }),
  );

  await getCognitoClient().send(
    new AdminSetUserPasswordCommand({
      UserPoolId: this.config.userPoolId,
      Username: username,
      Password: password,
      Permanent: true,
    }),
  );

  this.cognitoUsername = username;
  this.srpPassword = password;
});

When<DaleWorld>('the user authenticates via SRP', async function () {
  // Skip in local mode
  if (this.config.localMode) {
    return 'skipped';
  }

  assert.ok(this.cognitoUsername, 'No Cognito username set');
  assert.ok(this.srpPassword, 'No SRP password set');

  const tokens = await srpAuthenticate(
    this.config.userPoolId,
    this.config.userPoolClientId,
    this.cognitoUsername,
    this.srpPassword,
  );

  this.idToken = tokens.idToken;
  this.accessToken = tokens.accessToken;
  this.refreshToken = tokens.refreshToken;
});

Then<DaleWorld>('the SRP login should succeed with valid tokens', function () {
  // Skip in local mode
  if (this.config.localMode) {
    return 'skipped';
  }

  assert.ok(this.idToken, 'Missing idToken');
  assert.ok(this.accessToken, 'Missing accessToken');
  assert.ok(this.refreshToken, 'Missing refreshToken');
});
