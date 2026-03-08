import { getRooms, Room, getTenantStats, TenantStats } from '../services/api';
import '../components/room-list-item';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
    }

    .dashboard {
      max-width: 1000px;
      margin: 0 auto;
      padding: 3rem 1.5rem;
    }

    .header {
      margin-bottom: 2rem;
    }

    .header h1 {
      font-family: var(--font-serif, Georgia, serif);
      font-size: 2rem;
      font-weight: 400;
      color: var(--color-text, #2C2C2C);
      margin: 0 0 0.5rem 0;
    }

    .header p {
      color: var(--color-text-secondary, #5C5C5C);
      margin: 0;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1.5rem;
      margin-bottom: 3rem;
    }

    .stat-card {
      background-color: var(--color-surface, #FFFFFF);
      border: 1px solid var(--color-border, #E8E4DC);
      border-radius: 16px;
      padding: 1.5rem;
      text-align: center;
    }

    .stat-value {
      font-family: var(--font-serif, Georgia, serif);
      font-size: 2.5rem;
      font-weight: 300;
      color: var(--color-text, #2C2C2C);
    }

    .stat-label {
      font-size: 0.85rem;
      color: var(--color-text-muted, #8E8E8E);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-top: 0.5rem;
    }

    .section {
      margin-bottom: 2rem;
    }

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1rem;
    }

    .section-header h2 {
      font-family: var(--font-serif, Georgia, serif);
      font-size: 1.5rem;
      font-weight: 400;
      color: var(--color-text, #2C2C2C);
      margin: 0;
    }

    .rooms-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
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

    .empty-state {
      text-align: center;
      padding: 3rem;
      background-color: var(--color-surface, #FFFFFF);
      border: 1px solid var(--color-border, #E8E4DC);
      border-radius: 16px;
    }

    .empty-state h3 {
      font-family: var(--font-serif, Georgia, serif);
      font-size: 1.25rem;
      color: var(--color-text, #2C2C2C);
      margin: 0 0 0.5rem 0;
    }

    .empty-state p {
      color: var(--color-text-muted, #8E8E8E);
      margin: 0 0 1.5rem 0;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.75rem 1.5rem;
      font-family: var(--font-sans, system-ui, sans-serif);
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--color-text-inverse, #F6F4EF);
      background-color: var(--color-accent, #8A9A7E);
      border: none;
      border-radius: 9999px;
      text-decoration: none;
      cursor: pointer;
      transition: background-color 0.35s cubic-bezier(0.25, 0.1, 0.25, 1);
    }

    .btn:hover {
      background-color: var(--color-accent-hover, #7A8A6E);
    }

    @media (max-width: 768px) {
      .stats-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
  <section class="dashboard">
    <div class="header">
      <h1>Creator Dashboard</h1>
      <p>Overview of your rooms and subscribers</p>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value total-rooms">0</div>
        <div class="stat-label">Rooms</div>
      </div>
      <div class="stat-card">
        <div class="stat-value total-subscribers">0</div>
        <div class="stat-label">Subscribers</div>
      </div>
      <div class="stat-card">
        <div class="stat-value monthly-revenue">$0</div>
        <div class="stat-label">Monthly Revenue</div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <h2>Your Rooms</h2>
        <a href="/rooms" data-nav class="btn">Manage Rooms</a>
      </div>
      <div class="rooms-content">
        <div class="loading">
          <div class="spinner"></div>
        </div>
      </div>
    </div>
  </section>
`;

export class DashboardPage extends HTMLElement {
  private rooms: Room[] = [];
  private stats: TenantStats | null = null;
  private loading = true;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.shadowRoot!.appendChild(template.content.cloneNode(true));
    this.loadData();
  }

  private async loadData(): Promise<void> {
    try {
      const [rooms, stats] = await Promise.all([
        getRooms(),
        getTenantStats(),
      ]);
      this.rooms = rooms;
      this.stats = stats;
      this.loading = false;
      this.render();
    } catch (err) {
      this.loading = false;
      this.render();
    }
  }

  private render(): void {
    const roomsContent = this.shadowRoot!.querySelector('.rooms-content')!;
    const totalRoomsEl = this.shadowRoot!.querySelector('.total-rooms')!;
    const totalSubscribersEl = this.shadowRoot!.querySelector('.total-subscribers')!;
    const revenueEl = this.shadowRoot!.querySelector('.monthly-revenue')!;

    if (this.stats) {
      totalRoomsEl.textContent = String(this.stats.totalRooms);
      totalSubscribersEl.textContent = String(this.stats.totalSubscribers);
      revenueEl.textContent = this.stats.monthlyRevenue
        ? `$${this.stats.monthlyRevenue.toLocaleString()}`
        : '$0';
    }

    if (this.loading) {
      roomsContent.innerHTML = `
        <div class="loading">
          <div class="spinner"></div>
        </div>
      `;
      return;
    }

    if (this.rooms.length === 0) {
      roomsContent.innerHTML = `
        <div class="empty-state">
          <h3>No rooms yet</h3>
          <p>Create your first room to start accepting subscribers.</p>
          <a href="/rooms" data-nav class="btn">Create Room</a>
        </div>
      `;
      return;
    }

    const list = document.createElement('div');
    list.className = 'rooms-list';

    this.rooms.slice(0, 5).forEach((room) => {
      const item = document.createElement('room-list-item') as HTMLElement & { data: Room };
      item.data = room;
      list.appendChild(item);
    });

    roomsContent.innerHTML = '';
    roomsContent.appendChild(list);
  }
}

customElements.define('dashboard-page', DashboardPage);
