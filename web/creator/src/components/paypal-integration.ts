import { configurePayment } from '../services/api';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
    }

    .integration {
      background-color: var(--color-surface, #FFFFFF);
      border: 1px solid var(--color-border, #E8E4DC);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1rem;
    }

    .integration-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1rem;
    }

    .integration-title {
      font-family: var(--font-serif, Georgia, serif);
      font-size: 1.125rem;
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
      border-radius: 9999px;
    }

    .status-badge--configured {
      background-color: rgba(138, 154, 126, 0.08);
      color: #8A9A7E;
    }

    .status-badge--unconfigured {
      background-color: rgba(142, 142, 142, 0.08);
      color: #8E8E8E;
    }

    .form-field {
      margin-bottom: 1rem;
    }

    .form-label {
      display: block;
      font-size: 0.8rem;
      font-weight: 500;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--color-text-secondary, #5C5C5C);
      margin-bottom: 0.5rem;
    }

    .form-input {
      width: 100%;
      padding: 0.75rem 1rem;
      font-family: var(--font-sans, system-ui, sans-serif);
      font-size: 0.9rem;
      color: var(--color-text, #2C2C2C);
      background-color: var(--color-surface, #FFFFFF);
      border: 1px solid var(--color-border, #E8E4DC);
      border-radius: 8px;
      box-sizing: border-box;
    }

    .form-input:focus {
      outline: none;
      border-color: var(--color-accent, #8A9A7E);
      box-shadow: 0 0 0 3px rgba(138, 154, 126, 0.12);
    }

    .btn {
      padding: 0.6rem 1.25rem;
      font-family: var(--font-sans, system-ui, sans-serif);
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--color-text-inverse, #F6F4EF);
      background-color: var(--color-accent, #8A9A7E);
      border: none;
      border-radius: 9999px;
      cursor: pointer;
    }

    .btn:hover {
      background-color: var(--color-accent-hover, #7A8A6E);
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .error {
      color: #D66853;
      font-size: 0.85rem;
      margin-top: 0.5rem;
    }

    .success {
      color: #8A9A7E;
      font-size: 0.85rem;
      margin-top: 0.5rem;
    }

    .webhook-url {
      background-color: var(--color-background, #F6F4EF);
      border: 1px solid var(--color-border, #E8E4DC);
      border-radius: 8px;
      padding: 0.75rem 1rem;
      font-family: monospace;
      font-size: 0.8rem;
      word-break: break-all;
      margin-top: 1rem;
    }

    .webhook-url-label {
      font-size: 0.75rem;
      font-weight: 500;
      text-transform: uppercase;
      color: var(--color-text-secondary, #5C5C5C);
      margin-bottom: 0.5rem;
    }
  </style>
  <div class="integration">
    <div class="integration-header">
      <h3 class="integration-title">PayPal</h3>
      <span class="status-badge status-badge--unconfigured">Not configured</span>
    </div>
    <form class="integration-form">
      <div class="form-field">
        <label class="form-label" for="paypalClientId">Client ID</label>
        <input class="form-input" type="text" id="paypalClientId" placeholder="Your PayPal Client ID">
      </div>
      <div class="form-field">
        <label class="form-label" for="paypalClientSecret">Client Secret</label>
        <input class="form-input" type="password" id="paypalClientSecret" placeholder="Your PayPal Client Secret">
      </div>
      <button type="submit" class="btn">Save</button>
      <div class="message"></div>
    </form>
    <div class="webhook-info" style="display: none;">
      <p class="webhook-url-label">Webhook URL (auto-registered)</p>
      <div class="webhook-url"></div>
    </div>
  </div>
`;

export class PaypalIntegration extends HTMLElement {
  private _configured = false;

  static get observedAttributes(): string[] {
    return ['configured'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.shadowRoot!.appendChild(template.content.cloneNode(true));
    this.updateStatus();

    const form = this.shadowRoot!.querySelector('.integration-form')!;
    form.addEventListener('submit', (e) => this.handleSubmit(e));
  }

  attributeChangedCallback(name: string, _oldValue: string, newValue: string): void {
    if (name === 'configured') {
      this._configured = newValue === 'true';
      if (this.shadowRoot) {
        this.updateStatus();
      }
    }
  }

  private updateStatus(): void {
    const badge = this.shadowRoot!.querySelector('.status-badge')!;
    if (this._configured) {
      badge.textContent = 'Connected';
      badge.className = 'status-badge status-badge--configured';
    } else {
      badge.textContent = 'Not configured';
      badge.className = 'status-badge status-badge--unconfigured';
    }
  }

  private async handleSubmit(e: Event): Promise<void> {
    e.preventDefault();

    const clientIdInput = this.shadowRoot!.getElementById('paypalClientId') as HTMLInputElement;
    const clientSecretInput = this.shadowRoot!.getElementById('paypalClientSecret') as HTMLInputElement;
    const btn = this.shadowRoot!.querySelector('.btn') as HTMLButtonElement;
    const messageEl = this.shadowRoot!.querySelector('.message')!;
    const webhookInfo = this.shadowRoot!.querySelector('.webhook-info') as HTMLElement;
    const webhookUrlEl = this.shadowRoot!.querySelector('.webhook-url')!;

    const clientId = clientIdInput.value.trim();
    const clientSecret = clientSecretInput.value.trim();

    if (!clientId || !clientSecret) {
      messageEl.className = 'error';
      messageEl.textContent = 'Both client ID and client secret are required';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Saving...';
    messageEl.textContent = '';

    try {
      const result = await configurePayment({
        paypalClientId: clientId,
        paypalClientSecret: clientSecret,
      });

      this._configured = true;
      this.updateStatus();
      messageEl.className = 'success';
      messageEl.textContent = 'PayPal configured successfully';

      if (result.paypalWebhookUrl) {
        webhookUrlEl.textContent = result.paypalWebhookUrl;
        webhookInfo.style.display = 'block';
      }

      this.dispatchEvent(new CustomEvent('integration-configured', {
        detail: { type: 'paypal' },
        bubbles: true,
        composed: true,
      }));
    } catch (err) {
      const error = err as { error?: string };
      messageEl.className = 'error';
      messageEl.textContent = error.error || 'Failed to configure PayPal';
      this.dispatchEvent(new CustomEvent('integration-error', {
        detail: { type: 'paypal', error: error.error || 'Configuration failed' },
        bubbles: true,
        composed: true,
      }));
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save';
    }
  }
}

customElements.define('paypal-integration', PaypalIntegration);
