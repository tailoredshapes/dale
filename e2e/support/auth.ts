import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminInitiateAuthCommand,
  AdminDeleteUserCommand,
  AuthFlowType,
  MessageActionType,
} from '@aws-sdk/client-cognito-identity-provider';

// Use region from environment with fallback to us-east-1
const region = process.env.AWS_REGION ?? process.env.E2E_REGION ?? 'us-east-1';
const cognitoClient = new CognitoIdentityProviderClient({ region });

export interface TestUser {
  username: string;
  idToken: string;
  accessToken: string;
  refreshToken: string;
}

export async function createTestUser(
  userPoolId: string,
  clientId: string,
): Promise<TestUser> {
  const username = `e2e-test-${Date.now()}@test.dale.dev`;
  const password = `E2eTest!${Date.now()}`;

  await cognitoClient.send(
    new AdminCreateUserCommand({
      UserPoolId: userPoolId,
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
      UserPoolId: userPoolId,
      Username: username,
      Password: password,
      Permanent: true,
    }),
  );

  const authResult = await cognitoClient.send(
    new AdminInitiateAuthCommand({
      UserPoolId: userPoolId,
      ClientId: clientId,
      AuthFlow: AuthFlowType.ADMIN_USER_PASSWORD_AUTH,
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
      },
    }),
  );

  const idToken = authResult.AuthenticationResult?.IdToken;
  const accessToken = authResult.AuthenticationResult?.AccessToken;
  const refreshToken = authResult.AuthenticationResult?.RefreshToken;
  if (!idToken || !accessToken || !refreshToken) {
    throw new Error('Failed to get tokens from Cognito');
  }

  return { username, idToken, accessToken, refreshToken };
}

export async function deleteTestUser(
  userPoolId: string,
  username: string,
): Promise<void> {
  try {
    await cognitoClient.send(
      new AdminDeleteUserCommand({
        UserPoolId: userPoolId,
        Username: username,
      }),
    );
  } catch (err: any) {
    if (err.name !== 'UserNotFoundException') {
      throw err;
    }
  }
}
