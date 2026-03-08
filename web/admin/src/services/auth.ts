import { getConfig } from './config';

interface AuthTokens {
  idToken: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

const AUTH_STORAGE_KEY = 'dale_admin_auth';

let authTokens: AuthTokens | null = null;
let authListeners: Array<(isAuthenticated: boolean) => void> = [];

export function initAuth(): void {
  const stored = sessionStorage.getItem(AUTH_STORAGE_KEY);
  if (stored) {
    try {
      authTokens = JSON.parse(stored);
      if (authTokens && authTokens.expiresAt < Date.now()) {
        authTokens = null;
        sessionStorage.removeItem(AUTH_STORAGE_KEY);
      }
    } catch {
      authTokens = null;
    }
  }

  handleAuthCallback();
}

function handleAuthCallback(): void {
  const hash = window.location.hash;
  if (!hash || !hash.includes('id_token=')) return;

  const params = new URLSearchParams(hash.slice(1));
  const idToken = params.get('id_token');
  const accessToken = params.get('access_token');
  const expiresIn = params.get('expires_in');

  if (idToken && accessToken) {
    authTokens = {
      idToken,
      accessToken,
      expiresAt: Date.now() + (parseInt(expiresIn || '3600', 10) * 1000),
    };
    sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authTokens));
    window.history.replaceState(null, '', window.location.pathname);
    notifyListeners(true);
  }
}

export function isAuthenticated(): boolean {
  return authTokens !== null && authTokens.expiresAt > Date.now();
}

export function getAuthToken(): string | null {
  if (!isAuthenticated()) return null;
  return authTokens?.idToken || null;
}

export function getUserInfo(): { email?: string; sub?: string } | null {
  if (!authTokens?.idToken) return null;
  try {
    const payload = authTokens.idToken.split('.')[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

export function signIn(): void {
  const config = getConfig();
  if (!config.cognitoDomain || !config.cognitoClientId) {
    console.error('Cognito not configured');
    return;
  }

  const authUrl = new URL(`https://${config.cognitoDomain}/oauth2/authorize`);
  authUrl.searchParams.set('client_id', config.cognitoClientId);
  authUrl.searchParams.set('response_type', 'token');
  authUrl.searchParams.set('scope', 'openid email profile');
  authUrl.searchParams.set('redirect_uri', config.redirectUri);

  window.location.href = authUrl.toString();
}

export function signOut(): void {
  const config = getConfig();
  authTokens = null;
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
  notifyListeners(false);

  if (config.cognitoDomain && config.cognitoClientId) {
    const logoutUrl = new URL(`https://${config.cognitoDomain}/logout`);
    logoutUrl.searchParams.set('client_id', config.cognitoClientId);
    logoutUrl.searchParams.set('logout_uri', window.location.origin);
    window.location.href = logoutUrl.toString();
  }
}

export function onAuthChange(listener: (isAuthenticated: boolean) => void): () => void {
  authListeners.push(listener);
  return () => {
    authListeners = authListeners.filter((l) => l !== listener);
  };
}

function notifyListeners(isAuthenticated: boolean): void {
  authListeners.forEach((listener) => listener(isAuthenticated));
}
