import { useState, useEffect } from 'react';
import { useTenant } from '../hooks/useTenant';
import { api } from '../api/client';
import type { InviteResponse, AdminUser, ConfigurePaymentResponse, ConfigureTelegramResponse } from '../api/types';

export function SettingsPage() {
  const { tenant, loading, reload } = useTenant();
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [savingTelegram, setSavingTelegram] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<string | null>(null);

  const [stripeSecretKey, setStripeSecretKey] = useState('');
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState('');
  const [paypalClientId, setPaypalClientId] = useState('');
  const [paypalClientSecret, setPaypalClientSecret] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoadingUsers(true);
    try {
      const result = await api.get<AdminUser[]>('/api/admin/users');
      setUsers(result);
    } catch {
      // ignore — endpoint may not be available
    } finally {
      setLoadingUsers(false);
    }
  }

  if (loading) return <p>Loading...</p>;
  if (!tenant) return <p>No tenant found.</p>;

  async function handleSave() {
    setSaving(true);
    try {
      await api.put('/api/tenant', { displayName: displayName || tenant!.displayName });
      await reload();
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveTelegram() {
    if (!telegramBotToken) return;
    setSavingTelegram(true);
    setTelegramStatus(null);
    try {
      const result = await api.put<ConfigureTelegramResponse>('/api/tenant/telegram', { telegramBotToken });
      setTelegramStatus(result.webhookRegistered ? 'Bot connected and webhook registered.' : 'Bot saved (webhook registration pending).');
      setTelegramBotToken('');
    } catch (err: any) {
      setTelegramStatus(err.message ?? 'Failed to connect Telegram bot');
    } finally {
      setSavingTelegram(false);
    }
  }

  async function handleRegisterWebhook() {
    setRegistering(true);
    try {
      const result = await api.post<{ registered: boolean }>('/api/tenant/register-webhook');
      setWebhookStatus(result.registered ? 'Webhook registered successfully' : 'Webhook registration failed');
    } catch {
      setWebhookStatus('Failed to register webhook');
    } finally {
      setRegistering(false);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setInviteStatus(null);
    try {
      const result = await api.post<InviteResponse>('/api/admin/invite', { email: inviteEmail });
      setInviteStatus(`Invited ${result.email}`);
      setInviteEmail('');
      await loadUsers();
    } catch (err: any) {
      setInviteStatus(err.message ?? 'Failed to invite user');
    } finally {
      setInviting(false);
    }
  }

  async function handleSavePayment() {
    setSavingPayment(true);
    setPaymentStatus(null);

    const body: Record<string, string> = {};
    if (stripeSecretKey && stripeWebhookSecret) {
      body.stripeSecretKey = stripeSecretKey;
      body.stripeWebhookSecret = stripeWebhookSecret;
    }
    if (paypalClientId && paypalClientSecret) {
      body.paypalClientId = paypalClientId;
      body.paypalClientSecret = paypalClientSecret;
    }

    if (Object.keys(body).length === 0) {
      setPaymentStatus('Please fill in at least one payment provider.');
      setSavingPayment(false);
      return;
    }

    try {
      const result = await api.put<ConfigurePaymentResponse>('/api/tenant/payment', body);
      const parts: string[] = ['Payment providers configured.'];
      if (result.stripeWebhookUrl) parts.push(`Stripe webhook URL: ${result.stripeWebhookUrl}`);
      if (result.paypalWebhookUrl) parts.push(`PayPal webhook URL: ${result.paypalWebhookUrl}`);
      setPaymentStatus(parts.join(' '));
      setStripeSecretKey('');
      setStripeWebhookSecret('');
      setPaypalClientId('');
      setPaypalClientSecret('');
    } catch (err: any) {
      setPaymentStatus(err.message ?? 'Failed to configure payment providers');
    } finally {
      setSavingPayment(false);
    }
  }

  return (
    <div>
      <h1>Settings</h1>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Profile</h2>
        <p>Tenant ID: <code>{tenant.tenantId}</code></p>
        <div className="form-group">
          <label>Display Name:</label>
          <input
            type="text"
            value={displayName || tenant.displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Payment Providers</h2>
        <p>Configure your payment provider credentials. Payment links are set per-room.</p>

        <h3>Stripe</h3>
        <div className="form-group">
          <label>Secret key:</label>
          <input
            type="text"
            placeholder="sk_live_..."
            value={stripeSecretKey}
            onChange={(e) => setStripeSecretKey(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Webhook signing secret:</label>
          <input
            type="text"
            placeholder="whsec_..."
            value={stripeWebhookSecret}
            onChange={(e) => setStripeWebhookSecret(e.target.value)}
          />
        </div>

        <h3>PayPal</h3>
        <div className="form-group">
          <label>Client ID:</label>
          <input
            type="text"
            placeholder="PayPal client ID"
            value={paypalClientId}
            onChange={(e) => setPaypalClientId(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Client secret:</label>
          <input
            type="text"
            placeholder="PayPal client secret"
            value={paypalClientSecret}
            onChange={(e) => setPaypalClientSecret(e.target.value)}
          />
        </div>

        <button className="btn-primary" onClick={handleSavePayment} disabled={savingPayment}>
          {savingPayment ? 'Saving...' : 'Save Payment Settings'}
        </button>
        {paymentStatus && <p style={{ marginTop: '0.5rem' }}>{paymentStatus}</p>}
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Telegram Bot</h2>
        <p>Connect a Telegram bot to manage group access. Get a token from <strong>@BotFather</strong>.</p>
        <div className="form-group">
          <label>Bot token:</label>
          <input
            type="text"
            placeholder="123456789:ABCdef..."
            value={telegramBotToken}
            onChange={(e) => setTelegramBotToken(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className="btn-primary" onClick={handleSaveTelegram} disabled={savingTelegram || !telegramBotToken}>
            {savingTelegram ? 'Connecting...' : 'Connect Bot'}
          </button>
          <button className="btn-secondary" onClick={handleRegisterWebhook} disabled={registering} style={{ fontSize: '0.85rem' }}>
            {registering ? 'Re-registering...' : 'Re-register webhook'}
          </button>
        </div>
        {telegramStatus && <p style={{ marginTop: '0.5rem' }}>{telegramStatus}</p>}
        {webhookStatus && <p style={{ marginTop: '0.5rem' }}>{webhookStatus}</p>}
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Invite User</h2>
        <form onSubmit={handleInvite}>
          <div className="form-group">
            <label>Email:</label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
            />
          </div>
          <button className="btn-primary" type="submit" disabled={inviting}>
            {inviting ? 'Sending...' : 'Send Invite'}
          </button>
        </form>
        {inviteStatus && <p style={{ marginTop: '0.5rem' }}>{inviteStatus}</p>}
      </section>

      <section>
        <h2>Platform Users</h2>
        {loadingUsers ? (
          <p>Loading users...</p>
        ) : users.length === 0 ? (
          <p>No users yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.5rem' }}>Email</th>
                <th style={{ textAlign: 'left', padding: '0.5rem' }}>Status</th>
                <th style={{ textAlign: 'left', padding: '0.5rem' }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.email}>
                  <td style={{ padding: '0.5rem' }}>{u.email}</td>
                  <td style={{ padding: '0.5rem' }}>{u.status}</td>
                  <td style={{ padding: '0.5rem' }}>
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
