import type { Room } from '../services/api';
import { createSubscription } from '../services/api';
import { showError } from '../services/toast';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
    }

    .payment-selector {
      background-color: var(--color-surface, #FFFFFF);
      border: 1px solid var(--color-border, #E8E4DC);
      border-radius: 16px;
      padding: 2rem;
      max-width: 480px;
      margin: 0 auto;
    }

    h2 {
      font-family: var(--font-serif, Georgia, serif);
      font-size: 1.75rem;
      font-weight: 400;
      color: var(--color-text, #2C2C2C);
      margin: 0 0 0.5rem 0;
      text-align: center;
    }

    .room-info {
      text-align: center;
      margin-bottom: 2rem;
    }

    .room-name {
      font-family: var(--font-serif, Georgia, serif);
      font-size: 1.25rem;
      color: var(--color-text, #2C2C2C);
      margin-bottom: 0.5rem;
    }

    .room-price {
      font-size: 1.5rem;
      font-weight: 500;
      color: var(--color-accent, #8A9A7E);
    }

    .payment-options {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .payment-option {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      width: 100%;
      padding: 1rem 1.5rem;
      font-family: var(--font-sans, system-ui, sans-serif);
      font-size: 1rem;
      font-weight: 500;
      border: 1px solid var(--color-border, #E8E4DC);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.35s cubic-bezier(0.25, 0.1, 0.25, 1);
    }

    .payment-option:hover:not(:disabled) {
      border-color: var(--color-text, #2C2C2C);
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.03);
    }

    .payment-option:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .payment-option--stripe {
      background-color: #635bff;
      color: white;
      border-color: #635bff;
    }

    .payment-option--stripe:hover:not(:disabled) {
      background-color: #5851db;
      border-color: #5851db;
    }

    .payment-option--paypal {
      background-color: #0070ba;
      color: white;
      border-color: #0070ba;
    }

    .payment-option--paypal:hover:not(:disabled) {
      background-color: #005ea6;
      border-color: #005ea6;
    }

    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }

    .spinner {
      width: 18px;
      height: 18px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    .back-link {
      display: block;
      text-align: center;
      margin-top: 1.5rem;
      color: var(--color-text-muted, #8E8E8E);
      text-decoration: none;
      font-size: 0.9rem;
    }

    .back-link:hover {
      color: var(--color-accent, #8A9A7E);
    }

    .unavailable {
      font-size: 0.85rem;
      color: var(--color-text-muted, #8E8E8E);
      text-align: center;
      padding: 1rem;
    }
  </style>
  <div class="payment-selector">
    <h2>Complete Subscription</h2>
    <div class="room-info">
      <div class="room-name"></div>
      <div class="room-price"></div>
    </div>
    <div class="payment-options">
      <button class="payment-option payment-option--stripe" data-provider="stripe">
        Pay with Stripe
      </button>
      <button class="payment-option payment-option--paypal" data-provider="paypal">
        Pay with PayPal
      </button>
    </div>
    <a href="/" data-nav class="back-link">Back to rooms</a>
  </div>
`;

export class PaymentSelector extends HTMLElement {
  private room?: Room;
  private loading = false;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.shadowRoot!.appendChild(template.content.cloneNode(true));
    this.render();

    this.shadowRoot!.querySelectorAll('.payment-option').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const provider = (e.currentTarget as HTMLElement).dataset.provider as 'stripe' | 'paypal';
        this.handlePayment(provider);
      });
    });
  }

  set data(room: Room) {
    this.room = room;
    if (this.shadowRoot) {
      this.render();
    }
  }

  private render(): void {
    if (!this.room) return;

    const nameEl = this.shadowRoot!.querySelector('.room-name')!;
    const priceEl = this.shadowRoot!.querySelector('.room-price')!;
    const stripeBtn = this.shadowRoot!.querySelector('[data-provider="stripe"]') as HTMLButtonElement;
    const paypalBtn = this.shadowRoot!.querySelector('[data-provider="paypal"]') as HTMLButtonElement;

    nameEl.textContent = this.room.name;
    priceEl.textContent = this.room.priceDescription || '';

    const hasStripe = !!this.room.paymentLink;
    const hasPaypal = !!this.room.paypalPaymentLink;

    stripeBtn.disabled = this.loading || !hasStripe;
    paypalBtn.disabled = this.loading || !hasPaypal;

    if (!hasStripe) {
      stripeBtn.style.display = 'none';
    }
    if (!hasPaypal) {
      paypalBtn.style.display = 'none';
    }

    if (!hasStripe && !hasPaypal) {
      const optionsEl = this.shadowRoot!.querySelector('.payment-options')!;
      optionsEl.innerHTML = '<p class="unavailable">Payment options are not available for this room.</p>';
    }
  }

  private async handlePayment(provider: 'stripe' | 'paypal'): Promise<void> {
    if (!this.room || this.loading) return;

    this.loading = true;
    const btn = this.shadowRoot!.querySelector(`[data-provider="${provider}"]`) as HTMLButtonElement;
    const originalText = btn.textContent;
    btn.innerHTML = '<span class="loading"><span class="spinner"></span>Redirecting...</span>';
    btn.disabled = true;

    try {
      const { redirectUrl } = await createSubscription(this.room.roomId, provider);
      window.location.href = redirectUrl;
    } catch (err) {
      this.loading = false;
      btn.innerHTML = originalText || '';
      btn.disabled = false;
      showError('Failed to start payment. Please try again.');
    }
  }
}

customElements.define('payment-selector', PaymentSelector);
