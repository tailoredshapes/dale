import { getConfig } from './config';

interface AuthTokens {
  idToken: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

interface TenantInfo {
  tenantId: string;
  webhookSecret: string;
  displayName: string;
  isOnboarded: boolean;
}

const AUTH_STORAGE_KEY = 'dale_creator_auth';
const TENANT_STORAGE_KEY = 'dale_creator_tenant';

let authTokens: AuthTokens | null = null;
let tenantInfo: TenantInfo | null = null;
let authListeners: Array<(isAuthenticated: boolean) => void> = [];

export function initAuth(): void {
  const storedAuth = sessionStorage.getItem(AUTH_STORAGE_KEY);
  if (storedAuth) {
    try {
      authTokens = JSON.parse(storedAuth);
      if (authTokens && authTokens.expiresAt < Date.now()) {
        authTokens = null;
        sessionStorage.removeItem(AUTH_STORAGE_KEY);
      }
    } catch {
      authTokens = null;
    }
  }

  const storedTenant = sessionStorage.getItem(TENANT_STORAGE_KEY);
  if (storedTenant) {
    try {
      tenantInfo = JSON.parse(storedTenant);
    } catch {
      tenantInfo = null;
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

export function getWebhookSecret(): string | null {
  return tenantInfo?.webhookSecret || null;
}

export function getTenantInfo(): TenantInfo | null {
  return tenantInfo;
}

export function setTenantInfo(info: TenantInfo): void {
  tenantInfo = info;
  sessionStorage.setItem(TENANT_STORAGE_KEY, JSON.stringify(info));
}

export function isOnboarded(): boolean {
  return tenantInfo?.isOnboarded || false;
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
  tenantInfo = null;
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
  sessionStorage.removeItem(TENANT_STORAGE_KEY);
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
