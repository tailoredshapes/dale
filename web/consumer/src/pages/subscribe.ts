import { getRoom, Room } from '../services/api';
import '../components/payment-selector';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
    }

    .subscribe-page {
      min-height: 60vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 3rem 1.5rem;
    }

    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4rem;
    }

    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid var(--color-border, #E8E4DC);
      border-top-color: var(--color-accent, #8A9A7E);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    .error {
      text-align: center;
      padding: 2rem;
      background-color: var(--color-surface, #FFFFFF);
      border: 1px solid var(--color-border, #E8E4DC);
      border-radius: 16px;
      max-width: 480px;
    }

    .error h2 {
      font-family: var(--font-serif, Georgia, serif);
      font-size: 1.5rem;
      color: var(--color-text, #2C2C2C);
      margin: 0 0 0.5rem 0;
    }

    .error p {
      color: var(--color-text-muted, #8E8E8E);
      margin: 0 0 1.5rem 0;
    }

    .back-link {
      display: inline-flex;
      align-items: center;
      padding: 0.75rem 1.5rem;
      font-family: var(--font-sans, system-ui, sans-serif);
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--color-text, #2C2C2C);
      background-color: transparent;
      border: 1px solid var(--color-border, #E8E4DC);
      border-radius: 9999px;
      text-decoration: none;
      transition: border-color 0.35s cubic-bezier(0.25, 0.1, 0.25, 1);
    }

    .back-link:hover {
      border-color: var(--color-text, #2C2C2C);
    }
  </style>
  <section class="subscribe-page">
    <div class="content">
      <div class="loading">
        <div class="spinner"></div>
      </div>
    </div>
  </section>
`;

export class SubscribePage extends HTMLElement {
  private room?: Room;
  private loading = true;
  private error: string | null = null;
  private roomId?: string;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.shadowRoot!.appendChild(template.content.cloneNode(true));

    if (this.roomId) {
      this.loadRoom();
    }
  }

  set params(value: { roomId: string }) {
    this.roomId = value.roomId;
    if (this.shadowRoot) {
      this.loadRoom();
    }
  }

  private async loadRoom(): Promise<void> {
    if (!this.roomId) return;

    this.loading = true;
    this.render();

    try {
      this.room = await getRoom(this.roomId);
      this.loading = false;
      this.render();
    } catch (err) {
      this.loading = false;
      this.error = 'Room not found';
      this.render();
    }
  }

  private render(): void {
    const contentEl = this.shadowRoot!.querySelector('.content')!;

    if (this.loading) {
      contentEl.innerHTML = `
        <div class="loading">
          <div class="spinner"></div>
        </div>
      `;
      return;
    }

    if (this.error || !this.room) {
      contentEl.innerHTML = `
        <div class="error">
          <h2>Room Not Found</h2>
          <p>The room you're looking for doesn't exist or is no longer available.</p>
          <a href="/" data-nav class="back-link">Back to Rooms</a>
        </div>
      `;
      return;
    }

    const selector = document.createElement('payment-selector') as HTMLElement & { data: Room };
    selector.data = this.room;

    contentEl.innerHTML = '';
    contentEl.appendChild(selector);
  }
}

customElements.define('subscribe-page', SubscribePage);
