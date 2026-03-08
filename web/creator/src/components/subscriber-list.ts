import type { Subscriber } from '../services/api';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
    }

    .subscriber-list {
      background-color: var(--color-surface, #FFFFFF);
      border: 1px solid var(--color-border, #E8E4DC);
      border-radius: 16px;
      overflow: hidden;
    }

    .list-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--color-border, #E8E4DC);
    }

    h3 {
      font-family: var(--font-serif, Georgia, serif);
      font-size: 1.25rem;
      font-weight: 400;
      color: var(--color-text, #2C2C2C);
      margin: 0;
    }

    .count {
      font-size: 0.85rem;
      color: var(--color-text-muted, #8E8E8E);
    }

    .subscriber-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid var(--color-border, #E8E4DC);
    }

    .subscriber-item:last-child {
      border-bottom: none;
    }

    .subscriber-info {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .avatar {
      width: 40px;
      height: 40px;
      background-color: var(--color-accent-light, #E8ECE4);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: var(--font-sans, system-ui, sans-serif);
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--color-accent, #8A9A7E);
    }

    .subscriber-name {
      font-weight: 500;
      color: var(--color-text, #2C2C2C);
    }

    .subscriber-username {
      font-size: 0.85rem;
      color: var(--color-text-muted, #8E8E8E);
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
    .status-badge--none {
      background-color: rgba(181, 112, 107, 0.08);
      color: #B5706B;
    }

    .empty-state {
      text-align: center;
      padding: 3rem 1.5rem;
      color: var(--color-text-muted, #8E8E8E);
    }
  </style>
  <div class="subscriber-list">
    <div class="list-header">
      <h3>Subscribers</h3>
      <span class="count"></span>
    </div>
    <div class="list-content"></div>
  </div>
`;

export class SubscriberList extends HTMLElement {
  private subscribers: Subscriber[] = [];

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.shadowRoot!.appendChild(template.content.cloneNode(true));
    this.render();
  }

  set data(subscribers: Subscriber[]) {
    this.subscribers = subscribers;
    if (this.shadowRoot) {
      this.render();
    }
  }

  private render(): void {
    const countEl = this.shadowRoot!.querySelector('.count')!;
    const contentEl = this.shadowRoot!.querySelector('.list-content')!;

    countEl.textContent = `${this.subscribers.length} total`;

    if (this.subscribers.length === 0) {
      contentEl.innerHTML = `
        <div class="empty-state">
          <p>No subscribers yet</p>
        </div>
      `;
      return;
    }

    contentEl.innerHTML = this.subscribers.map((sub) => `
      <div class="subscriber-item">
        <div class="subscriber-info">
          <div class="avatar">${this.getInitial(sub)}</div>
          <div>
            <div class="subscriber-name">${sub.telegramFirstName || 'User'}</div>
            <div class="subscriber-username">${sub.telegramUsername ? '@' + sub.telegramUsername : 'ID: ' + sub.telegramUserId}</div>
          </div>
        </div>
        <span class="status-badge status-badge--${sub.subscriptionStatus}">${sub.subscriptionStatus}</span>
      </div>
    `).join('');
  }

  private getInitial(sub: Subscriber): string {
    if (sub.telegramFirstName) {
      return sub.telegramFirstName.charAt(0).toUpperCase();
    }
    return 'U';
  }
}

customElements.define('subscriber-list', SubscriberList);
