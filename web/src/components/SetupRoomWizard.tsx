import { useState } from 'react';
import { api } from '../api/client';
import type { OnboardResponse, CreateRoomRequest } from '../api/types';

interface SetupRoomWizardProps {
  hasTenant: boolean;
  onComplete: () => void;
}

function CollapsibleHelp({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="collapsible-help">
      <button type="button" className="collapsible-toggle" onClick={() => setOpen(!open)}>
        {open ? '\u25BC' : '\u25B6'} {title}
      </button>
      {open && <div className="collapsible-content">{children}</div>}
    </div>
  );
}

export function SetupRoomWizard({ hasTenant, onComplete }: SetupRoomWizardProps) {
  const totalSteps = hasTenant ? 1 : 2;
  const firstStep = hasTenant ? 1 : 0;

  const [step, setStep] = useState(firstStep);
  const [displayName, setDisplayName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [paymentLink, setPaymentLink] = useState('');
  const [paypalPaymentLink, setPaypalPaymentLink] = useState('');
  const [priceDescription, setPriceDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [createdRoomName, setCreatedRoomName] = useState('');

  function currentStepNumber(): number {
    if (hasTenant) return step - 1; // steps 2,3 become 1,2
    return step + 1;
  }

  const hasPaymentLink = !!(paymentLink || paypalPaymentLink);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      if (!hasTenant) {
        await api.post<OnboardResponse>('/api/tenant/onboard', {
          displayName,
        });
      }

      const roomReq: CreateRoomRequest = { name: roomName };
      if (paymentLink) roomReq.paymentLink = paymentLink;
      if (paypalPaymentLink) roomReq.paypalPaymentLink = paypalPaymentLink;
      if (priceDescription) roomReq.priceDescription = priceDescription;

      await api.post('/api/rooms', roomReq);
      setCreatedRoomName(roomName);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="wizard-success">
        <div className="success-icon">{'\u{1F389}'}</div>
        <h3>Your paid group is ready!</h3>
        <p>"{createdRoomName}" has been created. Now add your bot to a Telegram group to start accepting subscribers.</p>
        <CollapsibleHelp title="How to add your bot to a Telegram group">
          <ol>
            <li>Open your Telegram group</li>
            <li>Go to group Settings {'\u2192'} Add Members</li>
            <li>Search for your bot's username</li>
            <li>Add the bot and make it an admin</li>
            <li>The bot will automatically link to your group</li>
          </ol>
        </CollapsibleHelp>
        <button className="btn-primary" onClick={onComplete} style={{ marginTop: '1rem' }}>
          Go to Dashboard
        </button>
      </div>
    );
  }

  const progressPercent = ((currentStepNumber() - 1) / totalSteps) * 100;

  const steps = [
    // Step 0: Display name
    <div key="name">
      <h3>Step 1 of {totalSteps}: Your display name</h3>
      <p className="help-text">This is the name your subscribers will see.</p>
      <div className="form-group">
        <input
          type="text"
          placeholder="Your creator name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </div>
      <button className="btn-primary" onClick={() => setStep(1)} disabled={!displayName}>
        Next
      </button>
    </div>,
    // Step 1: Group details
    <div key="room">
      <h3>{hasTenant ? `Step 1 of ${totalSteps}` : `Step 2 of ${totalSteps}`}: Set up your paid group</h3>
      <div className="form-group">
        <label>Paid group name:</label>
        <p className="help-text">This is the name subscribers will see when they join.</p>
        <input
          type="text"
          placeholder="e.g. VIP Trading Signals"
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
        />
      </div>
      <div className="form-group">
        <label>Stripe payment link:</label>
        <CollapsibleHelp title="How to create a Stripe payment link">
          <ol>
            <li>Go to <a href="https://dashboard.stripe.com/payment-links" target="_blank" rel="noopener">dashboard.stripe.com/payment-links</a></li>
            <li>Click "New" to create a payment link</li>
            <li>Choose "Subscription" as the type</li>
            <li>Set your price (e.g. $9.99/month)</li>
            <li>Copy the payment link URL</li>
            <li>Paste it below</li>
          </ol>
        </CollapsibleHelp>
        <input
          type="text"
          placeholder="https://buy.stripe.com/..."
          value={paymentLink}
          onChange={(e) => setPaymentLink(e.target.value)}
        />
      </div>
      <div className="form-group">
        <label>PayPal payment link <span style={{ color: 'var(--text-dim)' }}>(or use PayPal instead)</span>:</label>
        <input
          type="text"
          placeholder="https://paypal.com/..."
          value={paypalPaymentLink}
          onChange={(e) => setPaypalPaymentLink(e.target.value)}
        />
      </div>
      <div className="form-group">
        <label>Price description <span style={{ color: 'var(--text-dim)' }}>(optional)</span>:</label>
        <input
          type="text"
          placeholder="$9.99/month"
          value={priceDescription}
          onChange={(e) => setPriceDescription(e.target.value)}
        />
      </div>
      {!hasPaymentLink && (
        <p className="help-text" style={{ color: 'var(--text-dim)' }}>
          You can add payment links later from Settings.
        </p>
      )}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {!hasTenant && <button className="btn-secondary" onClick={() => setStep(0)}>Back</button>}
        <button className="btn-primary" onClick={handleSubmit} disabled={!roomName || submitting}>
          {submitting ? 'Creating...' : 'Create Group'}
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
    </div>,
  ];

  return (
    <div>
      <div className="wizard-progress">
        <div className="wizard-progress-bar" style={{ width: `${progressPercent}%` }} />
      </div>
      {steps[step]}
    </div>
  );
}
