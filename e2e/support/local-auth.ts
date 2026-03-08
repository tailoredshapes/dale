/**
 * Local auth support for E2E tests running against docker-compose
 * Uses the mock auth endpoints in local/server.ts
 */

export interface TestUser {
  username: string;
  idToken: string;
  accessToken: string;
  refreshToken: string;
}

export async function createLocalTestUser(adminApiUrl: string): Promise<TestUser> {
  const email = `e2e-test-${Date.now()}@test.local`;

  const response = await fetch(`${adminApiUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'test-password' }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to create local test user: ${response.status} ${text}`);
  }

  const data = await response.json();

  return {
    username: data.username ?? email,
    idToken: data.idToken,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  };
}

export async function deleteLocalTestUser(_adminApiUrl: string, _username: string): Promise<void> {
  // Local mode doesn't persist users, no cleanup needed
}
