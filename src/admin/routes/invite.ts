import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  ListUsersCommand,
  MessageActionType,
} from '@aws-sdk/client-cognito-identity-provider';
import type { InviteToken } from '../../db/invite-tokens.js';

// Use region from environment with fallback - Lambda provides AWS_REGION automatically
const cognito = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION ?? 'us-east-1',
});

export interface InviteUserDeps {
  createUser: (userPoolId: string, email: string, temporaryPassword: string) => Promise<void>;
  storeToken: (token: InviteToken) => Promise<void>;
  sendEmail: (to: string, magicLink: string) => Promise<void>;
  generateToken: () => string;
  generatePassword: () => string;
  baseUrl: string;
}

export interface RedeemInviteDeps {
  getToken: (id: string) => Promise<InviteToken | null>;
  markUsed: (id: string) => Promise<void>;
}

export async function handleInviteUser(
  userPoolId: string,
  tenantId: string,
  body: string,
  deps: InviteUserDeps,
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

  const token = deps.generateToken();
  const temporaryPassword = deps.generatePassword();

  // Create Cognito user with MessageAction: SUPPRESS (no Cognito email)
  await deps.createUser(userPoolId, email, temporaryPassword);

  // Store token in meshql-rs (24h TTL)
  const inviteToken: InviteToken = {
    id: token,
    email,
    temporaryPassword,
    tenantId,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
  await deps.storeToken(inviteToken);

  // Send email with magic link
  const magicLink = `${deps.baseUrl}/accept-invite?token=${token}`;
  await deps.sendEmail(email, magicLink);

  return { statusCode: 201, body: JSON.stringify({ email, invited: true }) };
}

export async function handleRedeemInvite(
  tokenId: string,
  deps: RedeemInviteDeps,
): Promise<{ statusCode: number; body: string }> {
  const token = await deps.getToken(tokenId);

  if (!token) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Token not found' }) };
  }

  // Check if already used
  if (token.usedAt) {
    return { statusCode: 410, body: JSON.stringify({ error: 'Token already used' }) };
  }

  // Check if expired
  if (new Date(token.expiresAt) < new Date()) {
    return { statusCode: 410, body: JSON.stringify({ error: 'Token expired' }) };
  }

  // Mark as used
  await deps.markUsed(tokenId);

  return {
    statusCode: 200,
    body: JSON.stringify({
      email: token.email,
      temporaryPassword: token.temporaryPassword,
    }),
  };
}

// Default implementation for createUser
export async function createCognitoUser(
  userPoolId: string,
  email: string,
  temporaryPassword: string,
): Promise<void> {
  await cognito.send(
    new AdminCreateUserCommand({
      UserPoolId: userPoolId,
      Username: email,
      TemporaryPassword: temporaryPassword,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
      ],
      MessageAction: MessageActionType.SUPPRESS,
    }),
  );
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
