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

// Use region from environment with fallback to us-east-1
const region = process.env.AWS_REGION ?? process.env.E2E_REGION ?? 'us-east-1';
const cognitoClient = new CognitoIdentityProviderClient({ region });

Given<DaleWorld>('a temporary user exists for SRP testing', async function () {
  const username = `e2e-srp-${Date.now()}@test.dale.dev`;
  const password = `SrpTest!${Date.now()}`;

  await cognitoClient.send(
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

  await cognitoClient.send(
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
  assert.ok(this.idToken, 'Missing idToken');
  assert.ok(this.accessToken, 'Missing accessToken');
  assert.ok(this.refreshToken, 'Missing refreshToken');
});
