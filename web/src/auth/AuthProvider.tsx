import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  getCurrentUser,
  signInWithRedirect,
  signOut,
  signIn,
  confirmSignIn,
  fetchAuthSession,
} from '@aws-amplify/auth';

// Staging local auth: set window.DALE_CONFIG.localAuth = true + apiBase to bypass Cognito
declare global {
  interface Window {
    DALE_CONFIG?: { apiBase?: string; localAuth?: boolean };
  }
}

const LOCAL_TOKEN_KEY = 'dale_local_token';
const LOCAL_USER_KEY  = 'dale_local_user';

function getLocalApiBase(): string {
  return window.DALE_CONFIG?.apiBase ?? '';
}

function isLocalAuth(): boolean {
  return !!window.DALE_CONFIG?.localAuth;
}

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  userId: string | null;
  signInWithEmail: (email: string, password: string) => Promise<{ newPasswordRequired: boolean }>;
  registerWithEmail: (email: string, password: string) => Promise<void>;
  completeNewPassword: (newPassword: string) => Promise<void>;
  signInWithGoogle: () => void;
  signOut: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthState>({
  isAuthenticated: false,
  isLoading: true,
  userId: null,
  signInWithEmail: async () => ({ newPasswordRequired: false }),
  registerWithEmail: async () => {},
  completeNewPassword: async () => {},
  signInWithGoogle: () => {},
  signOut: async () => {},
  getToken: async () => null,
});

// ─── Local auth helpers ───────────────────────────────────────────────────────

async function localRegister(apiBase: string, email: string, password: string): Promise<string> {
  const res = await fetch(`${apiBase}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Registration failed');
  return data.idToken as string;
}

async function localSignIn(apiBase: string, email: string, password: string): Promise<string> {
  // Try login first; if user doesn't exist, register them automatically in staging
  const res = await fetch(`${apiBase}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (res.status === 404 || res.status === 401) {
    // Auto-register in local/staging mode (any password works on this server)
    return localRegister(apiBase, email, password);
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Sign in failed');
  return data.idToken as string;
}

// ─── AuthProvider ─────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    if (isLocalAuth()) {
      const token = localStorage.getItem(LOCAL_TOKEN_KEY);
      const user  = localStorage.getItem(LOCAL_USER_KEY);
      if (token && user) {
        setUserId(user);
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
        setUserId(null);
      }
      setIsLoading(false);
      return;
    }

    try {
      const user = await getCurrentUser();
      setUserId(user.userId);
      setIsAuthenticated(true);
    } catch {
      setIsAuthenticated(false);
      setUserId(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSignInWithEmail(
    email: string,
    password: string,
  ): Promise<{ newPasswordRequired: boolean }> {
    if (isLocalAuth()) {
      const token = await localSignIn(getLocalApiBase(), email, password);
      localStorage.setItem(LOCAL_TOKEN_KEY, token);
      localStorage.setItem(LOCAL_USER_KEY, email);
      setUserId(email);
      setIsAuthenticated(true);
      return { newPasswordRequired: false };
    }

    const result = await signIn({ username: email, password });
    if (result.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
      return { newPasswordRequired: true };
    }
    await checkAuth();
    return { newPasswordRequired: false };
  }

  async function handleRegisterWithEmail(email: string, password: string): Promise<void> {
    if (isLocalAuth()) {
      const token = await localRegister(getLocalApiBase(), email, password);
      localStorage.setItem(LOCAL_TOKEN_KEY, token);
      localStorage.setItem(LOCAL_USER_KEY, email);
      setUserId(email);
      setIsAuthenticated(true);
      return;
    }
    // In prod, Cognito handles registration via hosted UI — redirect there
    signInWithRedirect({});
  }

  async function handleCompleteNewPassword(newPassword: string): Promise<void> {
    await confirmSignIn({ challengeResponse: newPassword });
    await checkAuth();
  }

  function handleSignInWithGoogle() {
    if (isLocalAuth()) {
      alert('Google Sign-In is not available in local/staging mode. Use email + password.');
      return;
    }
    signInWithRedirect({ provider: { custom: 'Google' } });
  }

  async function handleSignOut() {
    if (isLocalAuth()) {
      localStorage.removeItem(LOCAL_TOKEN_KEY);
      localStorage.removeItem(LOCAL_USER_KEY);
      setIsAuthenticated(false);
      setUserId(null);
      return;
    }
    await signOut();
    setIsAuthenticated(false);
    setUserId(null);
  }

  async function getToken(): Promise<string | null> {
    if (isLocalAuth()) {
      return localStorage.getItem(LOCAL_TOKEN_KEY);
    }
    try {
      const session = await fetchAuthSession();
      return session.tokens?.idToken?.toString() ?? null;
    } catch {
      return null;
    }
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        userId,
        signInWithEmail: handleSignInWithEmail,
        registerWithEmail: handleRegisterWithEmail,
        completeNewPassword: handleCompleteNewPassword,
        signInWithGoogle: handleSignInWithGoogle,
        signOut: handleSignOut,
        getToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
