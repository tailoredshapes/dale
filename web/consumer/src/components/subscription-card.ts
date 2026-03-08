import type { Subscription } from '../services/api';
import { cancelSubscription } from '../services/api';
import { showSuccess, showError } from '../services/toast';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
    }

    .subscription-card {
      background-color: var(--color-surface, #FFFFFF);
      border: 1px solid var(--color-border, #E8E4DC);
      border-radius: 16px;
      padding: 1.5rem;
    }

    .subscription-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1rem;
    }

    .subscription-name {
      font-family: var(--font-serif, Georgia, serif);
      font-size: 1.25rem;
      font-weight: 400;
      color: var(--color-text, #2C2C2C);
      margin: 0;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      padding: 0.25rem 0.75rem;
      font-size: 0.75rem;
      font-weight: 500;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      border-radius: 9999px;
    }

    .status-badge--active {
      background-color: rgba(138, 154, 126, 0.08);
      color: #8A9A7E;
    }

    .status-badge--past_due {
      background-color: rgba(212, 165, 116, 0.08);
      color: #D4A574;
    }

    .status-badge--cancelled,
    .status-badge--cancelling {
      background-color: rgba(181, 112, 107, 0.08);
      color: #B5706B;
    }

    .subscription-meta {
      display: flex;
      align-items: center;
      gap: 1rem;
      font-size: 0.85rem;
      color: var(--color-text-muted, #8E8E8E);
      margin-bottom: 1rem;
    }

    .provider-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }

    .invite-link {
      display: block;
      margin-bottom: 1rem;
    }

    .invite-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.5rem;
      font-family: var(--font-sans, system-ui, sans-serif);
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--color-text-inverse, #F6F4EF);
      background-color: #0088cc;
      border: none;
      border-radius: 9999px;
      text-decoration: none;
      transition: background-color 0.35s cubic-bezier(0.25, 0.1, 0.25, 1);
    }

    .invite-btn:hover {
      background-color: #0077b5;
    }

    .actions {
      display: flex;
      gap: 0.75rem;
      margin-top: 1rem;
    }

    .cancel-btn {
      padding: 0.5rem 1rem;
      font-family: var(--font-sans, system-ui, sans-serif);
      font-size: 0.85rem;
      color: var(--color-error, #B5706B);
      background-color: transparent;
      border: 1px solid var(--color-border, #E8E4DC);
      border-radius: 9999px;
      cursor: pointer;
      transition: border-color 0.35s cubic-bezier(0.25, 0.1, 0.25, 1);
    }

    .cancel-btn:hover {
      border-color: var(--color-error, #B5706B);
    }

    .cancel-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  </style>
  <article class="subscription-card">
    <div class="subscription-header">
      <h3 class="subscription-name"></h3>
      <span class="status-badge"></span>
    </div>
    <div class="subscription-meta">
      <span class="provider-badge"></span>
    </div>
    <div class="invite-link"></div>
    <div class="actions">
      <button class="cancel-btn">Cancel Subscription</button>
    </div>
  </article>
`;

export class SubscriptionCard extends HTMLElement {
  private subscription?: Subscription;
  private cancelling = false;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.shadowRoot!.appendChild(template.content.cloneNode(true));
    this.render();

    const cancelBtn = this.shadowRoot!.querySelector('.cancel-btn')!;
    cancelBtn.addEventListener('click', () => this.handleCancel());
  }

  set data(subscription: Subscription) {
    this.subscription = subscription;
    if (this.shadowRoot) {
      this.render();
    }
  }

  private render(): void {
    if (!this.subscription) return;

    const nameEl = this.shadowRoot!.querySelector('.subscription-name')!;
    const badgeEl = this.shadowRoot!.querySelector('.status-badge')!;
    const providerEl = this.shadowRoot!.querySelector('.provider-badge')!;
    const inviteEl = this.shadowRoot!.querySelector('.invite-link')!;
    const cancelBtn = this.shadowRoot!.querySelector('.cancel-btn') as HTMLButtonElement;
    const actionsEl = this.shadowRoot!.querySelector('.actions')!;

    const status = this.cancelling ? 'cancelling' : this.subscription.status;

    nameEl.textContent = this.subscription.roomName;
    badgeEl.textContent = status;
    badgeEl.className = `status-badge status-badge--${status}`;
    providerEl.textContent = this.subscription.paymentProvider === 'stripe' ? 'Stripe' : 'PayPal';

    if (this.subscription.telegramInviteLink && this.subscription.status === 'active') {
      inviteEl.innerHTML = `
        <a href="${this.subscription.telegramInviteLink}" class="invite-btn" target="_blank" rel="noopener">
          Join Telegram Group
        </a>
      `;
    } else {
      inviteEl.innerHTML = '';
    }

    if (this.subscription.status === 'cancelled' || this.cancelling) {
      actionsEl.style.display = 'none';
    } else {
      actionsEl.style.display = 'flex';
      cancelBtn.disabled = this.cancelling;
      cancelBtn.textContent = this.cancelling ? 'Cancelling...' : 'Cancel Subscription';
    }
  }

  private async handleCancel(): Promise<void> {
    if (!this.subscription || this.cancelling) return;

    if (!confirm('Are you sure you want to cancel this subscription?')) {
      return;
    }

    this.cancelling = true;
    this.render();

    try {
      await cancelSubscription(this.subscription.id);
      showSuccess('Subscription cancelled');
      this.dispatchEvent(new CustomEvent('subscription-cancelled', {
        bubbles: true,
        detail: { subscriptionId: this.subscription.id },
      }));
    } catch (err) {
      this.cancelling = false;
      this.render();
      showError('Failed to cancel subscription');
    }
  }
}

customElements.define('subscription-card', SubscriptionCard);
