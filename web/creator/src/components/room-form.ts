import type { Room } from '../services/api';
import { createRoom, updateRoom } from '../services/api';
import { showError, showSuccess } from '../services/toast';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
    }

    .room-form {
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

    textarea.form-input {
      min-height: 100px;
      resize: vertical;
    }

    .field-hint {
      font-size: 0.8rem;
      color: var(--color-text-muted, #8E8E8E);
      margin-top: 0.5rem;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
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

    @media (max-width: 768px) {
      .form-row {
        grid-template-columns: 1fr;
      }
    }
  </style>
  <div class="room-form">
    <h2>Create Room</h2>
    <form>
      <div class="form-field">
        <label class="form-label" for="name">Room Name</label>
        <input class="form-input" type="text" id="name" name="name" placeholder="e.g., Premium Trading Signals" required>
      </div>

      <div class="form-field">
        <label class="form-label" for="description">Description</label>
        <textarea class="form-input" id="description" name="description" placeholder="Describe what subscribers will get..."></textarea>
      </div>

      <div class="form-field">
        <label class="form-label" for="telegramGroupId">Telegram Group ID</label>
        <input class="form-input" type="text" id="telegramGroupId" name="telegramGroupId" placeholder="-1001234567890">
        <p class="field-hint">The chat ID of your Telegram group. Add the bot as admin to get this.</p>
      </div>

      <div class="form-field">
        <label class="form-label" for="priceDescription">Price Description</label>
        <input class="form-input" type="text" id="priceDescription" name="priceDescription" placeholder="$29/month">
      </div>

      <div class="form-row">
        <div class="form-field">
          <label class="form-label" for="paymentLink">Stripe Payment Link</label>
          <input class="form-input" type="url" id="paymentLink" name="paymentLink" placeholder="https://buy.stripe.com/...">
        </div>

        <div class="form-field">
          <label class="form-label" for="paypalPaymentLink">PayPal Payment Link</label>
          <input class="form-input" type="url" id="paypalPaymentLink" name="paypalPaymentLink" placeholder="https://www.paypal.com/...">
        </div>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn btn--primary">Create Room</button>
        <button type="button" class="btn btn--secondary cancel-btn">Cancel</button>
      </div>
    </form>
  </div>
`;

export class RoomForm extends HTMLElement {
  private room?: Room;
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

    this.render();
  }

  set data(room: Room) {
    this.room = room;
    if (this.shadowRoot) {
      this.render();
    }
  }

  private render(): void {
    const titleEl = this.shadowRoot!.querySelector('h2')!;
    titleEl.textContent = this.room ? 'Edit Room' : 'Create Room';
    this.submitBtn.textContent = this.room ? 'Save Changes' : 'Create Room';

    if (this.room) {
      const inputs = this.form.elements;
      (inputs.namedItem('name') as HTMLInputElement).value = this.room.name || '';
      (inputs.namedItem('description') as HTMLTextAreaElement).value = this.room.description || '';
      (inputs.namedItem('telegramGroupId') as HTMLInputElement).value = this.room.telegramGroupId || '';
      (inputs.namedItem('priceDescription') as HTMLInputElement).value = this.room.priceDescription || '';
      (inputs.namedItem('paymentLink') as HTMLInputElement).value = this.room.paymentLink || '';
      (inputs.namedItem('paypalPaymentLink') as HTMLInputElement).value = this.room.paypalPaymentLink || '';
    }
  }

  private async handleSubmit(e: Event): Promise<void> {
    e.preventDefault();

    const formData = new FormData(this.form);
    const data = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      telegramGroupId: formData.get('telegramGroupId') as string,
      priceDescription: formData.get('priceDescription') as string,
      paymentLink: formData.get('paymentLink') as string,
      paypalPaymentLink: formData.get('paypalPaymentLink') as string,
    };

    this.submitBtn.disabled = true;
    this.submitBtn.textContent = this.room ? 'Saving...' : 'Creating...';

    try {
      if (this.room) {
        await updateRoom(this.room.roomId, data);
        showSuccess('Room updated successfully');
      } else {
        await createRoom(data);
        showSuccess('Room created successfully');
      }

      this.dispatchEvent(new CustomEvent('saved', { bubbles: true }));
    } catch (err) {
      showError('Failed to save room');
      this.submitBtn.disabled = false;
      this.submitBtn.textContent = this.room ? 'Save Changes' : 'Create Room';
    }
  }
}

customElements.define('room-form', RoomForm);
