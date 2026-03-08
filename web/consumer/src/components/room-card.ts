import type { Room } from '../services/api';
import { navigate } from '../services/router';
import { isAuthenticated, signIn } from '../services/auth';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
    }

    .room-card {
      background-color: var(--color-surface, #FFFFFF);
      border: 1px solid var(--color-border, #E8E4DC);
      border-radius: 16px;
      padding: 1.5rem;
      transition: box-shadow 0.35s cubic-bezier(0.25, 0.1, 0.25, 1),
                  border-color 0.35s cubic-bezier(0.25, 0.1, 0.25, 1);
    }

    .room-card:hover {
      box-shadow: 0 8px 40px rgba(0, 0, 0, 0.06);
      border-color: rgba(43, 43, 43, 0.12);
    }

    .room-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 1rem;
    }

    .room-name {
      font-family: var(--font-serif, Georgia, serif);
      font-size: 1.25rem;
      font-weight: 400;
      color: var(--color-text, #2C2C2C);
      margin: 0;
      line-height: 1.3;
    }

    .room-price {
      font-family: var(--font-sans, system-ui, sans-serif);
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--color-accent, #8A9A7E);
      white-space: nowrap;
    }

    .room-description {
      font-size: 0.95rem;
      color: var(--color-text-secondary, #5C5C5C);
      line-height: 1.6;
      margin: 0 0 1.5rem 0;
    }

    .room-creator {
      font-size: 0.8rem;
      color: var(--color-text-muted, #8E8E8E);
      margin-bottom: 1rem;
    }

    .subscribe-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      padding: 0.75rem 1.5rem;
      font-family: var(--font-sans, system-ui, sans-serif);
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--color-text-inverse, #F6F4EF);
      background-color: var(--color-accent, #8A9A7E);
      border: none;
      border-radius: 9999px;
      cursor: pointer;
      transition: background-color 0.35s cubic-bezier(0.25, 0.1, 0.25, 1);
    }

    .subscribe-btn:hover {
      background-color: var(--color-accent-hover, #7A8A6E);
    }
  </style>
  <article class="room-card">
    <div class="room-header">
      <h3 class="room-name"></h3>
      <span class="room-price"></span>
    </div>
    <p class="room-creator"></p>
    <p class="room-description"></p>
    <button class="subscribe-btn">Subscribe</button>
  </article>
`;

export class RoomCard extends HTMLElement {
  private room?: Room;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.shadowRoot!.appendChild(template.content.cloneNode(true));
    this.render();

    const btn = this.shadowRoot!.querySelector('.subscribe-btn')!;
    btn.addEventListener('click', () => this.handleSubscribe());
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
    const descEl = this.shadowRoot!.querySelector('.room-description')!;
    const creatorEl = this.shadowRoot!.querySelector('.room-creator')!;

    nameEl.textContent = this.room.name;
    priceEl.textContent = this.room.priceDescription || '';
    descEl.textContent = this.room.description || '';
    creatorEl.textContent = this.room.tenantDisplayName
      ? `by ${this.room.tenantDisplayName}`
      : '';
  }

  private handleSubscribe(): void {
    if (!this.room) return;

    if (!isAuthenticated()) {
      signIn();
      return;
    }

    navigate(`/subscribe/${this.room.roomId}`);
  }
}

customElements.define('room-card', RoomCard);
