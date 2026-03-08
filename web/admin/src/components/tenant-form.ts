import { createTenant, inviteUser } from '../services/api';
import { showError, showSuccess } from '../services/toast';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
    }

    .tenant-form {
      background-color: var(--color-surface, #FFFFFF);
      border: 1px solid var(--color-border, #E8E4DC);
      border-radius: 16px;
      padding: 2rem;
    }

    h2 {
      font-family: var(--font-serif, Georgia, serif);
      font-size: 1.5rem;
      font-weight: 400;
      color: var(--color-text, #2C2C2C);
      margin: 0 0 1.5rem 0;
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

    .form-actions {
      display: flex;
      gap: 1rem;
      margin-top: 2rem;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
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
  </style>
  <div class="tenant-form">
    <h2>Onboard New Tenant</h2>
    <form>
      <div class="form-field">
        <label class="form-label" for="displayName">Display Name</label>
        <input class="form-input" type="text" id="displayName" name="displayName" placeholder="Creator or brand name" required>
      </div>

      <div class="form-field">
        <label class="form-label" for="email">Creator Email</label>
        <input class="form-input" type="email" id="email" name="email" placeholder="creator@example.com" required>
        <p class="field-hint">An invitation will be sent to this email address</p>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn btn--primary">Create Tenant</button>
        <button type="button" class="btn btn--secondary cancel-btn">Cancel</button>
      </div>
    </form>
  </div>
`;

export class TenantForm extends HTMLElement {
  private form!: HTMLFormElement;
  private submitBtn!: HTMLButtonElement;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.shadowRoot!.appendChild(template.content.cloneNode(true));

    this.form = this.shadowRoot!.querySelector('form')!;
    this.submitBtn = this.shadowRoot!.querySelector('button[type="submit"]')!;

    this.form.addEventListener('submit', (e) => this.handleSubmit(e));

    const cancelBtn = this.shadowRoot!.querySelector('.cancel-btn')!;
    cancelBtn.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('cancel', { bubbles: true }));
    });
  }

  private async handleSubmit(e: Event): Promise<void> {
    e.preventDefault();

    const formData = new FormData(this.form);
    const displayName = formData.get('displayName') as string;
    const email = formData.get('email') as string;

    this.submitBtn.disabled = true;
    this.submitBtn.textContent = 'Creating...';

    try {
      await createTenant({ displayName, email });
      await inviteUser(email);
      showSuccess('Tenant created and invitation sent');
      this.dispatchEvent(new CustomEvent('saved', { bubbles: true }));
    } catch (err) {
      showError('Failed to create tenant');
      this.submitBtn.disabled = false;
      this.submitBtn.textContent = 'Create Tenant';
    }
  }
}

customElements.define('tenant-form', TenantForm);
