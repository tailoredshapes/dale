import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

const API_URL = import.meta.env.VITE_API_URL ?? '';

interface RedeemResponse {
  email: string;
  temporaryPassword: string;
}

export function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { signInWithEmail, completeNewPassword } = useAuth();

  const [status, setStatus] = useState<'loading' | 'signing-in' | 'new-password' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<RedeemResponse | null>(null);
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError('No invite token provided');
      setStatus('error');
      return;
    }
    redeemToken(token);
  }, [searchParams]);

  async function redeemToken(token: string) {
    try {
      const response = await fetch(`${API_URL}/api/invite/${token}`);

      if (response.status === 404) {
        setError('This invite link is invalid.');
        setStatus('error');
        return;
      }

      if (response.status === 410) {
        setError('This invite link has expired or has already been used.');
        setStatus('error');
        return;
      }

      if (!response.ok) {
        setError('Something went wrong. Please try again later.');
        setStatus('error');
        return;
      }

      const data: RedeemResponse = await response.json();
      setCredentials(data);
      setStatus('signing-in');

      // Attempt sign-in with the temporary password
      const result = await signInWithEmail(data.email, data.temporaryPassword);

      if (result.newPasswordRequired) {
        setStatus('new-password');
      } else {
        navigate('/');
      }
    } catch (err) {
      console.error('Error redeeming invite:', err);
      setError('Something went wrong. Please try again later.');
      setStatus('error');
    }
  }

  async function handleSetNewPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    try {
      await completeNewPassword(newPassword);
      navigate('/');
    } catch (err) {
      console.error('Error setting new password:', err);
      setError('Failed to set password. Please try again.');
    }
  }

  if (status === 'loading') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Accepting Invitation...</h1>
          <p>Please wait while we verify your invite link.</p>
        </div>
      </div>
    );
  }

  if (status === 'signing-in') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Signing you in...</h1>
          <p>Please wait...</p>
        </div>
      </div>
    );
  }

  if (status === 'new-password') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Set Your Password</h1>
          <p>Please choose a password for your account.</p>
          <form onSubmit={handleSetNewPassword}>
            <div style={{ marginBottom: '1rem' }}>
              <input
                type="password"
                placeholder="New password (min 8 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}
                autoFocus
              />
            </div>
            {error && <p style={{ color: 'var(--error)', marginBottom: '1rem' }}>{error}</p>}
            <button type="submit" className="btn-primary" style={{ width: '100%' }}>
              Continue
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Error state
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Invitation Error</h1>
        <p style={{ color: 'var(--error)' }}>{error}</p>
        <p style={{ marginTop: '1rem' }}>
          If you believe this is a mistake, please contact your administrator for a new invite.
        </p>
      </div>
    </div>
  );
}
