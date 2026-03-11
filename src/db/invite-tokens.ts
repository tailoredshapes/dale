import { restPost, restGet, restPut } from './client.js';

export interface InviteToken {
  id: string;           // UUID — the token
  email: string;
  temporaryPassword: string;
  tenantId: string;
  usedAt?: string;      // ISO timestamp, set on redemption
  expiresAt: string;    // ISO timestamp, 24h from creation
}

export async function createInviteToken(token: InviteToken): Promise<InviteToken> {
  return restPost<InviteToken>('/invite-token/api', token as unknown as Record<string, unknown>);
}

export async function getInviteToken(id: string): Promise<InviteToken | null> {
  return restGet<InviteToken>('/invite-token/api', id);
}

export async function markTokenUsed(id: string): Promise<void> {
  await restPut<InviteToken>('/invite-token/api', id, {
    usedAt: new Date().toISOString(),
  });
}
