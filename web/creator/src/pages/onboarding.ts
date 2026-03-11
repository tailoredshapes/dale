import { onboardTenant } from '../services/api';
import { showError } from '../services/toast';
import { navigate } from '../services/router';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
    }

    .onboarding {
      max-width: 480px;
      margin: 0 auto;
      padding: 3rem 1.5rem;
    }

    .header {
      text-align: center;
      margin-bottom: 2.5rem;
    }

    .header h1 {
      font-family: var(--font-serif, Georgia, serif);
      font-size: 2.5rem;
      font-weight: 300;
      color: var(--color-text, #2C2C2C);
      margin: 0 0 0.5rem 0;
    }

    .header p {
      font-size: 1.125rem;
      color: var(--color-text-secondary, #5C5C5C);
      margin: 0;
    }

    .card {
      background-color: var(--color-surface, #FFFFFF);
      border: 1px solid var(--color-border, #E8E4DC);
      border-radius: 16px;
      padding: 2rem;
    }

    .form-field {
      margin-bottom: 1.5rem;
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
      padding: 0.9rem 1.25rem;
      font-family: var(--font-sans, system-ui, sans-serif);
      font-size: 1rem;
      color: var(--color-text, #2C2C2C);
      background-color: var(--color-surface, #FFFFFF);
      border: 1px solid var(--color-border, #E8E4DC);
      border-radius: 8px;
      transition: border-color 0.35s cubic-bezier(0.25, 0.1, 0.25, 1),
                  box-shadow 0.35s cubic-bezier(0.25, 0.1, 0.25, 1);
      box-sizing: border-box;
    }

    .form-input:focus {
      outline: none;
      border-color: var(--color-accent, #8A9A7E);
      box-shadow: 0 0 0 3px rgba(138, 154, 126, 0.12);
    }

    .form-input::placeholder {
      color: var(--color-text-muted, #8E8E8E);
    }

    .btn {
      display: block;
      width: 100%;
      padding: 0.9rem 1.5rem;
      font-family: var(--font-sans, system-ui, sans-serif);
      font-size: 1rem;
      font-weight: 500;
      color: var(--color-text-inverse, #F6F4EF);
      background-color: var(--color-accent, #8A9A7E);
      border: none;
      border-radius: 9999px;
      cursor: pointer;
      transition: background-color 0.35s cubic-bezier(0.25, 0.1, 0.25, 1);
    }

    .btn:hover {
      background-color: var(--color-accent-hover, #7A8A6E);
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .hint {
      text-align: center;
      font-size: 0.9rem;
      color: var(--color-text-muted, #8E8E8E);
      margin-top: 1.25rem;
    }
  </style>
  <section class="onboarding">
    <div class="header">
      <h1>Welcome to Dalegram</h1>
      <p>Let's set up your creator account</p>
    </div>

    <div class="card">
      <div class="form-field">
        <label class="form-label" for="displayName">Display Name</label>
        <input class="form-input" type="text" id="displayName" placeholder="Your brand or creator name">
      </div>

      <button class="btn submit-btn">Get started</button>

      <p class="hint">Connect Telegram, Stripe, and PayPal from your dashboard settings.</p>
    </div>
  </section>
`;

export class OnboardingPage extends HTMLElement {
  private displayName = '';

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.shadowRoot!.appendChild(template.content.cloneNode(true));

    const input = this.shadowRoot!.getElementById('displayName') as HTMLInputElement;
    input.addEventListener('input', (e) => {
      this.displayName = (e.target as HTMLInputElement).value;
    });

    const submitBtn = this.shadowRoot!.querySelector('.submit-btn');
    submitBtn?.addEventListener('click', () => this.submit());
  }

  private async submit(): Promise<void> {
    if (!this.displayName.trim()) {
      showError('Please enter a display name');
      return;
    }

    const submitBtn = this.shadowRoot!.querySelector('.submit-btn') as HTMLButtonElement;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Setting up...';

    try {
      await onboardTenant({ displayName: this.displayName });
      navigate('/');
    } catch (err) {
      showError('Failed to complete setup. Please try again.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Get started';
    }
  }
}

customElements.define('onboarding-page', OnboardingPage);
