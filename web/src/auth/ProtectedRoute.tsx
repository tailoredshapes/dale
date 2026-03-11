import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from './AuthProvider';

type AuthMode = 'signin' | 'register';

export function ProtectedRoute() {
  const { isAuthenticated, isLoading, signInWithEmail, registerWithEmail, completeNewPassword, signInWithGoogle } =
    useAuth();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [needsNewPassword, setNeedsNewPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (isLoading) {
    return <div className="loading-text">Loading...</div>;
  }

  if (!isAuthenticated) {
    async function handleEmailSignIn(e: React.FormEvent) {
      e.preventDefault();
      setError('');
      setSubmitting(true);
      try {
        const result = await signInWithEmail(email, password);
        if (result.newPasswordRequired) {
          setNeedsNewPassword(true);
        }
      } catch (err: any) {
        setError(err.message ?? 'Sign in failed');
      } finally {
        setSubmitting(false);
      }
    }

    async function handleNewPassword(e: React.FormEvent) {
      e.preventDefault();
      setError('');
      setSubmitting(true);
      try {
        await completeNewPassword(newPassword);
      } catch (err: any) {
        setError(err.message ?? 'Failed to set new password');
      } finally {
        setSubmitting(false);
      }
    }

    async function handleRegister(e: React.FormEvent) {
      e.preventDefault();
      setError('');
      setSubmitting(true);
      try {
        await registerWithEmail(email, password);
      } catch (err: any) {
        setError(err.message ?? 'Registration failed');
      } finally {
        setSubmitting(false);
      }
    }

    const isStaging = !!(window as any).DALE_CONFIG?.localAuth;

    return (
      <div className="hero">
        <h1 className="glitch-auto neon-text">Dale</h1>
        <p>Creator dashboard for managing your Telegram subscriptions.</p>

        {needsNewPassword ? (
          <form onSubmit={handleNewPassword} style={{ maxWidth: '320px', margin: '1rem auto' }}>
            <p>Please set a new password to continue.</p>
            <div className="form-group">
              <label>New Password:</label>
              <input type="password" value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
            </div>
            <button className="btn-filled" type="submit" disabled={submitting}>
              {submitting ? 'Setting...' : 'Set Password'}
            </button>
          </form>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '1rem' }}>
              <button className={mode === 'signin' ? 'btn-filled' : 'btn-outline'}
                onClick={() => { setMode('signin'); setError(''); }}>Sign In</button>
              <button className={mode === 'register' ? 'btn-filled' : 'btn-outline'}
                onClick={() => { setMode('register'); setError(''); }}>Register</button>
            </div>

            <form onSubmit={mode === 'register' ? handleRegister : handleEmailSignIn}
              style={{ maxWidth: '320px', margin: '0 auto' }}>
              <div className="form-group">
                <label>Email:</label>
                <input type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Password:</label>
                <input type="password" value={password}
                  onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <button className="btn-filled" type="submit" disabled={submitting}>
                {submitting
                  ? (mode === 'register' ? 'Registering...' : 'Signing in...')
                  : (mode === 'register' ? 'Create Account' : 'Sign In')}
              </button>
            </form>
          </>
        )}

        {error && <p style={{ color: 'red', marginTop: '0.5rem' }}>{error}</p>}

        {!isStaging && (
          <>
            <div style={{ margin: '1rem 0', color: '#666' }}>&mdash; or &mdash;</div>
            <button className="btn-filled" onClick={signInWithGoogle}>
              Sign in with Google
            </button>
          </>
        )}
      </div>
    );
  }

  return <Outlet />;
}
