import { getPlatformStats, getTenants, PlatformStats, Tenant } from '../services/api';
import '../components/tenant-card';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
    }

    .dashboard {
      max-width: 1200px;
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
      grid-template-columns: repeat(4, 1fr);
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

    .stat-card--highlight .stat-value {
      color: var(--color-accent, #8A9A7E);
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

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.5rem 1rem;
      font-family: var(--font-sans, system-ui, sans-serif);
      font-size: 0.85rem;
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

    .tenants-list {
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

    .empty-state p {
      color: var(--color-text-muted, #8E8E8E);
      margin: 0;
    }

    @media (max-width: 1024px) {
      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 768px) {
      .stats-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
  <section class="dashboard">
    <div class="header">
      <h1>Platform Dashboard</h1>
      <p>Overview of Dalegram platform metrics</p>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value total-tenants">0</div>
        <div class="stat-label">Total Tenants</div>
      </div>
      <div class="stat-card">
        <div class="stat-value active-tenants">0</div>
        <div class="stat-label">Active Tenants</div>
      </div>
      <div class="stat-card">
        <div class="stat-value active-subscriptions">0</div>
        <div class="stat-label">Active Subscriptions</div>
      </div>
      <div class="stat-card stat-card--highlight">
        <div class="stat-value mrr">$0</div>
        <div class="stat-label">Monthly Recurring Revenue</div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <h2>Recent Tenants</h2>
        <a href="/tenants" data-nav class="btn">View All</a>
      </div>
      <div class="tenants-content">
        <div class="loading">
          <div class="spinner"></div>
        </div>
      </div>
    </div>
  </section>
`;

export class DashboardPage extends HTMLElement {
  private stats: PlatformStats | null = null;
  private tenants: Tenant[] = [];
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
      const [stats, tenants] = await Promise.all([
        getPlatformStats(),
        getTenants(),
      ]);
      this.stats = stats;
      this.tenants = tenants;
      this.loading = false;
      this.render();
    } catch (err) {
      this.loading = false;
      this.render();
    }
  }

  private render(): void {
    const tenantsContent = this.shadowRoot!.querySelector('.tenants-content')!;
    const totalTenantsEl = this.shadowRoot!.querySelector('.total-tenants')!;
    const activeTenantsEl = this.shadowRoot!.querySelector('.active-tenants')!;
    const activeSubscriptionsEl = this.shadowRoot!.querySelector('.active-subscriptions')!;
    const mrrEl = this.shadowRoot!.querySelector('.mrr')!;

    if (this.stats) {
      totalTenantsEl.textContent = String(this.stats.totalTenants);
      activeTenantsEl.textContent = String(this.stats.activeTenants);
      activeSubscriptionsEl.textContent = String(this.stats.activeSubscriptions);
      mrrEl.textContent = `$${this.stats.mrr.toLocaleString()}`;
    }

    if (this.loading) {
      tenantsContent.innerHTML = `
        <div class="loading">
          <div class="spinner"></div>
        </div>
      `;
      return;
    }

    if (this.tenants.length === 0) {
      tenantsContent.innerHTML = `
        <div class="empty-state">
          <p>No tenants yet</p>
        </div>
      `;
      return;
    }

    const list = document.createElement('div');
    list.className = 'tenants-list';

    this.tenants.slice(0, 5).forEach((tenant) => {
      const card = document.createElement('tenant-card') as HTMLElement & { data: Tenant };
      card.data = tenant;
      list.appendChild(card);
    });

    tenantsContent.innerHTML = '';
    tenantsContent.appendChild(list);
  }
}

customElements.define('dashboard-page', DashboardPage);
