import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';

// Use region from environment with fallback - Lambda provides AWS_REGION automatically
const cognito = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION ?? 'us-east-1',
});

export async function handleInviteUser(
  userPoolId: string,
  body: string,
): Promise<{ statusCode: number; body: string }> {
  let parsed: { email?: string };
  try {
    parsed = JSON.parse(body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const email = parsed.email?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Valid email is required' }) };
  }

  await cognito.send(
    new AdminCreateUserCommand({
      UserPoolId: userPoolId,
      Username: email,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
      ],
      DesiredDeliveryMediums: ['EMAIL'],
    }),
  );

  return { statusCode: 201, body: JSON.stringify({ email, invited: true }) };
}

export async function handleListUsers(
  userPoolId: string,
): Promise<{ statusCode: number; body: string }> {
  const result = await cognito.send(
    new ListUsersCommand({ UserPoolId: userPoolId }),
  );

  const users = (result.Users ?? []).map((u) => ({
    email: u.Attributes?.find((a) => a.Name === 'email')?.Value ?? '',
    status: u.UserStatus ?? '',
    createdAt: u.UserCreateDate?.toISOString() ?? '',
  }));

  return { statusCode: 200, body: JSON.stringify(users) };
}
