import { getTenant, suspendTenant, unsuspendTenant, TenantDetails } from '../services/api';
import { showSuccess, showError } from '../services/toast';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
    }

    .tenant-detail {
      max-width: 1200px;
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

    .status-badge--suspended {
      background-color: rgba(181, 112, 107, 0.08);
      color: #B5706B;
    }

    .tenant-id {
      font-size: 0.85rem;
      color: var(--color-text-muted, #8E8E8E);
      font-family: monospace;
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

    .btn--danger {
      background-color: transparent;
      color: var(--color-error, #B5706B);
      border-color: var(--color-border, #E8E4DC);
    }

    .btn--danger:hover {
      border-color: var(--color-error, #B5706B);
    }

    .btn--success {
      background-color: var(--color-accent, #8A9A7E);
      color: var(--color-text-inverse, #F6F4EF);
      border-color: var(--color-accent, #8A9A7E);
    }

    .btn--success:hover {
      background-color: var(--color-accent-hover, #7A8A6E);
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1.5rem;
      margin-bottom: 2rem;
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
      font-size: 2rem;
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

    .content-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
    }

    .section-card {
      background-color: var(--color-surface, #FFFFFF);
      border: 1px solid var(--color-border, #E8E4DC);
      border-radius: 16px;
      overflow: hidden;
    }

    .section-header {
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--color-border, #E8E4DC);
    }

    .section-header h3 {
      font-family: var(--font-serif, Georgia, serif);
      font-size: 1.25rem;
      font-weight: 400;
      color: var(--color-text, #2C2C2C);
      margin: 0;
    }

    .section-content {
      padding: 0;
    }

    .list-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid var(--color-border, #E8E4DC);
    }

    .list-item:last-child {
      border-bottom: none;
    }

    .item-name {
      font-weight: 500;
      color: var(--color-text, #2C2C2C);
    }

    .item-meta {
      font-size: 0.85rem;
      color: var(--color-text-muted, #8E8E8E);
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

    .empty-list {
      padding: 2rem;
      text-align: center;
      color: var(--color-text-muted, #8E8E8E);
    }

    @media (max-width: 1024px) {
      .stats-grid {
        grid-template-columns: 1fr;
      }

      .content-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
  <section class="tenant-detail">
    <a href="/tenants" data-nav class="back-link">&larr; Back to Tenants</a>
    <div class="content">
      <div class="loading">
        <div class="spinner"></div>
      </div>
    </div>
  </section>
`;

export class TenantDetailPage extends HTMLElement {
  private tenant?: TenantDetails;
  private loading = true;
  private tenantId?: string;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.shadowRoot!.appendChild(template.content.cloneNode(true));

    if (this.tenantId) {
      this.loadData();
    }
  }

  set params(value: { id: string }) {
    this.tenantId = value.id;
    if (this.shadowRoot) {
      this.loadData();
    }
  }

  private async loadData(): Promise<void> {
    if (!this.tenantId) return;

    this.loading = true;
    this.render();

    try {
      this.tenant = await getTenant(this.tenantId);
      this.loading = false;
      this.render();
    } catch (err) {
      this.loading = false;
      this.render();
    }
  }

  private async handleSuspend(): Promise<void> {
    if (!this.tenant) return;

    try {
      if (this.tenant.status === 'suspended') {
        await unsuspendTenant(this.tenant.tenantId);
        showSuccess('Tenant unsuspended');
      } else {
        await suspendTenant(this.tenant.tenantId);
        showSuccess('Tenant suspended');
      }
      this.loadData();
    } catch (err) {
      showError('Failed to update tenant status');
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

    if (!this.tenant) {
      contentEl.innerHTML = `
        <div class="loading">
          <p>Tenant not found</p>
        </div>
      `;
      return;
    }

    const isSuspended = this.tenant.status === 'suspended';

    contentEl.innerHTML = `
      <div class="header">
        <div class="header-info">
          <h1>${this.tenant.displayName}</h1>
          <div class="header-meta">
            <span class="status-badge status-badge--${this.tenant.status}">${this.tenant.status}</span>
            <span class="tenant-id">${this.tenant.tenantId}</span>
          </div>
        </div>
        <div class="header-actions">
          <button class="btn ${isSuspended ? 'btn--success' : 'btn--danger'} suspend-btn">
            ${isSuspended ? 'Unsuspend' : 'Suspend'}
          </button>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${this.tenant.rooms?.length || 0}</div>
          <div class="stat-label">Rooms</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${this.tenant.subscriberCount || 0}</div>
          <div class="stat-label">Subscribers</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">$${(this.tenant.monthlyRevenue || 0).toLocaleString()}</div>
          <div class="stat-label">Monthly Revenue</div>
        </div>
      </div>

      <div class="content-grid">
        <div class="section-card">
          <div class="section-header">
            <h3>Rooms</h3>
          </div>
          <div class="section-content rooms-list">
            ${this.tenant.rooms?.length
              ? this.tenant.rooms.map((room) => `
                <div class="list-item">
                  <div>
                    <div class="item-name">${room.name}</div>
                    <div class="item-meta">${room.subscriberCount || 0} subscribers</div>
                  </div>
                  <span class="status-badge status-badge--${room.isActive ? 'active' : 'suspended'}">
                    ${room.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              `).join('')
              : '<div class="empty-list">No rooms</div>'
            }
          </div>
        </div>

        <div class="section-card">
          <div class="section-header">
            <h3>Recent Subscribers</h3>
          </div>
          <div class="section-content subscribers-list">
            ${this.tenant.recentSubscribers?.length
              ? this.tenant.recentSubscribers.map((sub) => `
                <div class="list-item">
                  <div>
                    <div class="item-name">${sub.telegramFirstName || 'User'}</div>
                    <div class="item-meta">${sub.roomName || sub.roomId}</div>
                  </div>
                  <span class="status-badge status-badge--${sub.subscriptionStatus === 'active' ? 'active' : 'suspended'}">
                    ${sub.subscriptionStatus}
                  </span>
                </div>
              `).join('')
              : '<div class="empty-list">No subscribers</div>'
            }
          </div>
        </div>
      </div>
    `;

    const suspendBtn = contentEl.querySelector('.suspend-btn');
    suspendBtn?.addEventListener('click', () => this.handleSuspend());
  }
}

customElements.define('tenant-detail-page', TenantDetailPage);
