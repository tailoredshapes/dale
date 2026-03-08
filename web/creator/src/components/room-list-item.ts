import type { Room } from '../services/api';
import { navigate } from '../services/router';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
    }

    .room-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.25rem 1.5rem;
      background-color: var(--color-surface, #FFFFFF);
      border: 1px solid var(--color-border, #E8E4DC);
      border-radius: 12px;
      cursor: pointer;
      transition: box-shadow 0.35s cubic-bezier(0.25, 0.1, 0.25, 1),
                  border-color 0.35s cubic-bezier(0.25, 0.1, 0.25, 1);
    }

    .room-item:hover {
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.03);
      border-color: rgba(43, 43, 43, 0.12);
    }

    .room-info {
      flex: 1;
    }

    .room-name {
      font-family: var(--font-serif, Georgia, serif);
      font-size: 1.125rem;
      font-weight: 400;
      color: var(--color-text, #2C2C2C);
      margin: 0 0 0.25rem 0;
    }

    .room-meta {
      display: flex;
      align-items: center;
      gap: 1rem;
      font-size: 0.85rem;
      color: var(--color-text-muted, #8E8E8E);
    }

    .room-stats {
      display: flex;
      align-items: center;
      gap: 1.5rem;
    }

    .stat {
      text-align: center;
    }

    .stat-value {
      font-size: 1.25rem;
      font-weight: 500;
      color: var(--color-text, #2C2C2C);
    }

    .stat-label {
      font-size: 0.75rem;
      color: var(--color-text-muted, #8E8E8E);
      text-transform: uppercase;
      letter-spacing: 0.05em;
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

    .status-badge--inactive {
      background-color: rgba(142, 142, 142, 0.08);
      color: #8E8E8E;
    }
  </style>
  <article class="room-item">
    <div class="room-info">
      <h3 class="room-name"></h3>
      <div class="room-meta">
        <span class="status-badge"></span>
        <span class="price"></span>
      </div>
    </div>
    <div class="room-stats">
      <div class="stat">
        <div class="stat-value subscribers-count">0</div>
        <div class="stat-label">Subscribers</div>
      </div>
    </div>
  </article>
`;

export class RoomListItem extends HTMLElement {
  private room?: Room;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.shadowRoot!.appendChild(template.content.cloneNode(true));
    this.render();

    const item = this.shadowRoot!.querySelector('.room-item')!;
    item.addEventListener('click', () => {
      if (this.room) {
        navigate(`/rooms/${this.room.roomId}`);
      }
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
    const badgeEl = this.shadowRoot!.querySelector('.status-badge')!;
    const priceEl = this.shadowRoot!.querySelector('.price')!;
    const subscribersEl = this.shadowRoot!.querySelector('.subscribers-count')!;

    nameEl.textContent = this.room.name;
    badgeEl.textContent = this.room.isActive ? 'Active' : 'Inactive';
    badgeEl.className = `status-badge status-badge--${this.room.isActive ? 'active' : 'inactive'}`;
    priceEl.textContent = this.room.priceDescription || '';
    subscribersEl.textContent = String(this.room.subscriberCount || 0);
  }
}

customElements.define('room-list-item', RoomListItem);
