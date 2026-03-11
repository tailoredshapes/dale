import { getRoom, getRoomSubscribers, updateRoom, Room, Subscriber } from '../services/api';
import { showSuccess, showError } from '../services/toast';
import '../components/subscriber-list';
import '../components/room-form';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
    }

    .room-detail {
      max-width: 1000px;
      margin: 0 auto;
      padding: 3rem 1.5rem;
    }

    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--color-text-muted, #8E8E8E);
      text-decoration: none;
      font-size: 0.9rem;
      margin-bottom: 1.5rem;
    }

    .back-link:hover {
      color: var(--color-accent, #8A9A7E);
    }

    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 2rem;
    }

    .header-info h1 {
      font-family: var(--font-serif, Georgia, serif);
      font-size: 2rem;
      font-weight: 400;
      color: var(--color-text, #2C2C2C);
      margin: 0 0 0.5rem 0;
    }

    .header-meta {
      display: flex;
      align-items: center;
      gap: 1rem;
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

    .price {
      color: var(--color-text-secondary, #5C5C5C);
    }

    .header-actions {
      display: flex;
      gap: 0.75rem;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.5rem 1rem;
      font-family: var(--font-sans, system-ui, sans-serif);
      font-size: 0.85rem;
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
    }

    .btn--secondary {
      background-color: transparent;
      color: var(--color-text, #2C2C2C);
      border-color: var(--color-border, #E8E4DC);
    }

    .btn--secondary:hover {
      border-color: var(--color-text, #2C2C2C);
    }

    .btn--danger {
      background-color: transparent;
      color: var(--color-error, #B5706B);
      border-color: var(--color-border, #E8E4DC);
    }

    .btn--danger:hover {
      border-color: var(--color-error, #B5706B);
    }

    .content-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
    }

    .stats-card {
      background-color: var(--color-surface, #FFFFFF);
      border: 1px solid var(--color-border, #E8E4DC);
      border-radius: 16px;
      padding: 1.5rem;
    }

    .stats-card h3 {
      font-family: var(--font-serif, Georgia, serif);
      font-size: 1.25rem;
      font-weight: 400;
      color: var(--color-text, #2C2C2C);
      margin: 0 0 1rem 0;
    }

    .stat-row {
      display: flex;
      justify-content: space-between;
      padding: 0.75rem 0;
      border-bottom: 1px solid var(--color-border, #E8E4DC);
    }

    .stat-row:last-child {
      border-bottom: none;
    }

    .stat-label {
      color: var(--color-text-secondary, #5C5C5C);
    }

    .stat-value {
      font-weight: 500;
      color: var(--color-text, #2C2C2C);
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

    .form-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      z-index: 100;
    }

    .form-container {
      max-width: 600px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
    }

    @media (max-width: 768px) {
      .content-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
  <section class="room-detail">
    <a href="/rooms" data-nav class="back-link">&larr; Back to Rooms</a>
    <div class="content">
      <div class="loading">
        <div class="spinner"></div>
      </div>
    </div>
  </section>
`;

export class RoomDetailPage extends HTMLElement {
  private room?: Room;
  private subscribers: Subscriber[] = [];
  private loading = true;
  private roomId?: string;
  private showEditForm = false;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.shadowRoot!.appendChild(template.content.cloneNode(true));

    this.shadowRoot!.addEventListener('saved', () => {
      this.closeEditForm();
      this.loadData();
    });

    this.shadowRoot!.addEventListener('cancel', () => this.closeEditForm());

    if (this.roomId) {
      this.loadData();
    }
  }

  set params(value: { id: string }) {
    this.roomId = value.id;
    if (this.shadowRoot) {
      this.loadData();
    }
  }

  private async loadData(): Promise<void> {
    if (!this.roomId) return;

    this.loading = true;
    this.render();

    try {
      const [room, subscribers] = await Promise.all([
        getRoom(this.roomId),
        getRoomSubscribers(this.roomId),
      ]);
      this.room = room;
      this.subscribers = subscribers;
      this.loading = false;
      this.render();
    } catch (err) {
      this.loading = false;
      this.render();
    }
  }

  private openEditForm(): void {
    this.showEditForm = true;
    this.renderEditForm();
  }

  private closeEditForm(): void {
    this.showEditForm = false;
    const overlay = this.shadowRoot!.querySelector('.form-overlay');
    overlay?.remove();
  }

  private renderEditForm(): void {
    if (!this.showEditForm || !this.room) return;

    const overlay = document.createElement('div');
    overlay.className = 'form-overlay';

    const container = document.createElement('div');
    container.className = 'form-container';

    const form = document.createElement('room-form') as HTMLElement & { data: Room };
    form.data = this.room;
    container.appendChild(form);
    overlay.appendChild(container);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.closeEditForm();
      }
    });

    this.shadowRoot!.appendChild(overlay);
  }

  private async toggleActive(): Promise<void> {
    if (!this.room) return;

    try {
      await updateRoom(this.room.roomId, { isActive: !this.room.isActive });
      showSuccess(this.room.isActive ? 'Room deactivated' : 'Room activated');
      this.loadData();
    } catch (err) {
      showError('Failed to update room status');
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

    if (!this.room) {
      contentEl.innerHTML = `
        <div class="loading">
          <p>Room not found</p>
        </div>
      `;
      return;
    }

    contentEl.innerHTML = `
      <div class="header">
        <div class="header-info">
          <h1>${this.room.name}</h1>
          <div class="header-meta">
            <span class="status-badge status-badge--${this.room.isActive ? 'active' : 'inactive'}">
              ${this.room.isActive ? 'Active' : 'Inactive'}
            </span>
            <span class="price">${this.room.priceDescription || ''}</span>
          </div>
        </div>
        <div class="header-actions">
          <button class="btn btn--secondary edit-btn">Edit</button>
          <button class="btn ${this.room.isActive ? 'btn--danger' : 'btn--primary'} toggle-btn">
            ${this.room.isActive ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      </div>

      <div class="content-grid">
        <div class="stats-card">
          <h3>Room Details</h3>
          <div class="stat-row">
            <span class="stat-label">Description</span>
            <span class="stat-value">${this.room.description || 'No description'}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Telegram Group</span>
            <span class="stat-value">${this.room.telegramGroupId || 'Not set'}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Stripe Link</span>
            <span class="stat-value">${this.room.paymentLink ? 'Configured' : 'Not set'}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">PayPal Link</span>
            <span class="stat-value">${this.room.paypalPaymentLink ? 'Configured' : 'Not set'}</span>
          </div>
        </div>

        <div class="subscribers-section"></div>
      </div>
    `;

    const subscribersSection = contentEl.querySelector('.subscribers-section')!;
    const subscriberList = document.createElement('subscriber-list') as HTMLElement & { data: Subscriber[] };
    subscriberList.data = this.subscribers;
    subscribersSection.appendChild(subscriberList);

    const editBtn = contentEl.querySelector('.edit-btn');
    editBtn?.addEventListener('click', () => this.openEditForm());

    const toggleBtn = contentEl.querySelector('.toggle-btn');
    toggleBtn?.addEventListener('click', () => this.toggleActive());
  }
}

customElements.define('room-detail-page', RoomDetailPage);
