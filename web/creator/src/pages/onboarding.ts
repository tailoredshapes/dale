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
      max-width: 560px;
      margin: 0 auto;
      padding: 3rem 1.5rem;
    }

    .header {
      text-align: center;
      margin-bottom: 3rem;
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

    .progress {
      height: 2px;
      background-color: var(--color-border, #E8E4DC);
      border-radius: 2px;
      margin-bottom: 2rem;
      overflow: hidden;
    }

    .progress-bar {
      height: 100%;
      background-color: var(--color-accent, #8A9A7E);
      width: 33%;
      transition: width 0.35s cubic-bezier(0.25, 0.1, 0.25, 1);
    }

    .step {
      background-color: var(--color-surface, #FFFFFF);
      border: 1px solid var(--color-border, #E8E4DC);
      border-radius: 16px;
      padding: 2rem;
    }

    .step-title {
      font-family: var(--font-serif, Georgia, serif);
      font-size: 1.5rem;
      font-weight: 400;
      color: var(--color-text, #2C2C2C);
      margin: 0 0 0.5rem 0;
    }

    .step-description {
      color: var(--color-text-secondary, #5C5C5C);
      margin: 0 0 2rem 0;
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

    .field-hint {
      font-size: 0.8rem;
      color: var(--color-text-muted, #8E8E8E);
      margin-top: 0.5rem;
    }

    .optional-badge {
      font-size: 0.7rem;
      font-weight: 400;
      text-transform: none;
      letter-spacing: normal;
      color: var(--color-text-muted, #8E8E8E);
      margin-left: 0.5rem;
    }

    .step-actions {
      display: flex;
      justify-content: space-between;
      margin-top: 2rem;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.75rem 1.5rem;
      font-family: var(--font-sans, system-ui, sans-serif);
      font-size: 0.9rem;
      font-weight: 500;
      border-radius: 9999px;
      border: 1px solid transparent;
      cursor: pointer;
      transition: all 0.35s cubic-bezier(0.25, 0.1, 0.25, 1);
    }

    .btn--primary {
      background-color: var(--color-accent, #8A9A7E);
      color: var(--color-text-inverse, #F6F4EF);
      border-color: var(--color-accent, #8A9A7E);
    }

    .btn--primary:hover {
      background-color: var(--color-accent-hover, #7A8A6E);
      border-color: var(--color-accent-hover, #7A8A6E);
    }

    .btn--primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn--secondary {
      background-color: transparent;
      color: var(--color-text, #2C2C2C);
      border-color: var(--color-border, #E8E4DC);
    }

    .btn--secondary:hover {
      border-color: var(--color-text, #2C2C2C);
    }

    .section-divider {
      border-top: 1px solid var(--color-border, #E8E4DC);
      margin: 2rem 0;
      padding-top: 2rem;
    }

    .section-label {
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--color-text-secondary, #5C5C5C);
      margin-bottom: 1rem;
    }

    .payment-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    @media (max-width: 768px) {
      .payment-row {
        grid-template-columns: 1fr;
      }
    }
  </style>
  <section class="onboarding">
    <div class="header">
      <h1>Welcome to Dalegram</h1>
      <p>Let's set up your creator account</p>
    </div>

    <div class="progress">
      <div class="progress-bar"></div>
    </div>

    <div class="step" data-step="1">
      <h2 class="step-title">Basic Information</h2>
      <p class="step-description">Tell us about yourself</p>

      <div class="form-field">
        <label class="form-label" for="displayName">Display Name</label>
        <input class="form-input" type="text" id="displayName" placeholder="Your brand or creator name">
      </div>

      <div class="step-actions">
        <span></span>
        <button class="btn btn--primary next-btn">Continue</button>
      </div>
    </div>

    <div class="step" data-step="2" style="display: none;">
      <h2 class="step-title">Telegram Bot</h2>
      <p class="step-description">Connect your Telegram bot to manage group access</p>

      <div class="form-field">
        <label class="form-label" for="telegramBotToken">Bot Token</label>
        <input class="form-input" type="text" id="telegramBotToken" placeholder="123456789:ABCdefGHIjklMNO...">
        <p class="field-hint">Get this from @BotFather on Telegram</p>
      </div>

      <div class="step-actions">
        <button class="btn btn--secondary back-btn">Back</button>
        <button class="btn btn--primary next-btn">Continue</button>
      </div>
    </div>

    <div class="step" data-step="3" style="display: none;">
      <h2 class="step-title">Payment Setup</h2>
      <p class="step-description">Configure your payment providers</p>

      <div class="section-label">Stripe <span class="optional-badge">(optional)</span></div>
      <div class="payment-row">
        <div class="form-field">
          <label class="form-label" for="stripeSecretKey">Secret Key</label>
          <input class="form-input" type="password" id="stripeSecretKey" placeholder="sk_live_...">
        </div>
        <div class="form-field">
          <label class="form-label" for="stripeWebhookSecret">Webhook Secret</label>
          <input class="form-input" type="password" id="stripeWebhookSecret" placeholder="whsec_...">
        </div>
      </div>

      <div class="section-divider">
        <div class="section-label">PayPal <span class="optional-badge">(optional)</span></div>
        <div class="payment-row">
          <div class="form-field">
            <label class="form-label" for="paypalClientId">Client ID</label>
            <input class="form-input" type="text" id="paypalClientId" placeholder="Your PayPal Client ID">
          </div>
          <div class="form-field">
            <label class="form-label" for="paypalClientSecret">Client Secret</label>
            <input class="form-input" type="password" id="paypalClientSecret" placeholder="Your PayPal Secret">
          </div>
        </div>
      </div>

      <div class="step-actions">
        <button class="btn btn--secondary back-btn">Back</button>
        <button class="btn btn--primary submit-btn">Complete Setup</button>
      </div>
    </div>
  </section>
`;

export class OnboardingPage extends HTMLElement {
  private currentStep = 1;
  private data = {
    displayName: '',
    telegramBotToken: '',
    stripeSecretKey: '',
    stripeWebhookSecret: '',
    paypalClientId: '',
    paypalClientSecret: '',
  };

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.shadowRoot!.appendChild(template.content.cloneNode(true));

    this.shadowRoot!.querySelectorAll('.next-btn').forEach((btn) => {
      btn.addEventListener('click', () => this.nextStep());
    });

    this.shadowRoot!.querySelectorAll('.back-btn').forEach((btn) => {
      btn.addEventListener('click', () => this.prevStep());
    });

    const submitBtn = this.shadowRoot!.querySelector('.submit-btn');
    submitBtn?.addEventListener('click', () => this.submit());

    this.bindInputs();
  }

  private bindInputs(): void {
    const inputs = [
      'displayName',
      'telegramBotToken',
      'stripeSecretKey',
      'stripeWebhookSecret',
      'paypalClientId',
      'paypalClientSecret',
    ];

    inputs.forEach((id) => {
      const input = this.shadowRoot!.getElementById(id) as HTMLInputElement;
      if (input) {
        input.addEventListener('input', (e) => {
          (this.data as Record<string, string>)[id] = (e.target as HTMLInputElement).value;
        });
      }
    });
  }

  private nextStep(): void {
    if (this.currentStep === 1 && !this.data.displayName) {
      showError('Please enter a display name');
      return;
    }
    if (this.currentStep === 2 && !this.data.telegramBotToken) {
      showError('Please enter your Telegram bot token');
      return;
    }

    this.currentStep++;
    this.updateUI();
  }

  private prevStep(): void {
    this.currentStep--;
    this.updateUI();
  }

  private updateUI(): void {
    const progressBar = this.shadowRoot!.querySelector('.progress-bar') as HTMLElement;
    progressBar.style.width = `${(this.currentStep / 3) * 100}%`;

    this.shadowRoot!.querySelectorAll('.step').forEach((step) => {
      const stepNum = parseInt(step.getAttribute('data-step') || '0', 10);
      (step as HTMLElement).style.display = stepNum === this.currentStep ? 'block' : 'none';
    });
  }

  private async submit(): Promise<void> {
    const submitBtn = this.shadowRoot!.querySelector('.submit-btn') as HTMLButtonElement;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Setting up...';

    try {
      await onboardTenant({
        displayName: this.data.displayName,
        telegramBotToken: this.data.telegramBotToken,
        stripeSecretKey: this.data.stripeSecretKey || undefined,
        stripeWebhookSecret: this.data.stripeWebhookSecret || undefined,
        paypalClientId: this.data.paypalClientId || undefined,
        paypalClientSecret: this.data.paypalClientSecret || undefined,
      });

      navigate('/');
    } catch (err) {
      showError('Failed to complete setup. Please try again.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Complete Setup';
    }
  }
}

customElements.define('onboarding-page', OnboardingPage);
