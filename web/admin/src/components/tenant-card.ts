import type { Tenant } from '../services/api';
import { navigate } from '../services/router';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
    }

    .tenant-card {
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

    .tenant-card:hover {
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.03);
      border-color: rgba(43, 43, 43, 0.12);
    }

    .tenant-info {
      flex: 1;
    }

    .tenant-name {
      font-family: var(--font-serif, Georgia, serif);
      font-size: 1.125rem;
      font-weight: 400;
      color: var(--color-text, #2C2C2C);
      margin: 0 0 0.25rem 0;
    }

    .tenant-meta {
      display: flex;
      align-items: center;
      gap: 1rem;
      font-size: 0.85rem;
      color: var(--color-text-muted, #8E8E8E);
    }

    .tenant-stats {
      display: flex;
      align-items: center;
      gap: 2rem;
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

    .status-badge--suspended {
      background-color: rgba(181, 112, 107, 0.08);
      color: #B5706B;
    }
  </style>
  <article class="tenant-card">
    <div class="tenant-info">
      <h3 class="tenant-name"></h3>
      <div class="tenant-meta">
        <span class="status-badge"></span>
        <span class="tenant-id"></span>
      </div>
    </div>
    <div class="tenant-stats">
      <div class="stat">
        <div class="stat-value room-count">0</div>
        <div class="stat-label">Rooms</div>
      </div>
      <div class="stat">
        <div class="stat-value subscriber-count">0</div>
        <div class="stat-label">Subscribers</div>
      </div>
      <div class="stat">
        <div class="stat-value revenue">$0</div>
        <div class="stat-label">MRR</div>
      </div>
    </div>
  </article>
`;

export class TenantCard extends HTMLElement {
  private tenant?: Tenant;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.shadowRoot!.appendChild(template.content.cloneNode(true));
    this.render();

    const card = this.shadowRoot!.querySelector('.tenant-card')!;
    card.addEventListener('click', () => {
      if (this.tenant) {
        navigate(`/tenants/${this.tenant.tenantId}`);
      }
    });
  }

  set data(tenant: Tenant) {
    this.tenant = tenant;
    if (this.shadowRoot) {
      this.render();
    }
  }

  private render(): void {
    if (!this.tenant) return;

    const nameEl = this.shadowRoot!.querySelector('.tenant-name')!;
    const badgeEl = this.shadowRoot!.querySelector('.status-badge')!;
    const idEl = this.shadowRoot!.querySelector('.tenant-id')!;
    const roomCountEl = this.shadowRoot!.querySelector('.room-count')!;
    const subscriberCountEl = this.shadowRoot!.querySelector('.subscriber-count')!;
    const revenueEl = this.shadowRoot!.querySelector('.revenue')!;

    nameEl.textContent = this.tenant.displayName;
    badgeEl.textContent = this.tenant.status;
    badgeEl.className = `status-badge status-badge--${this.tenant.status}`;
    idEl.textContent = this.tenant.tenantId;
    roomCountEl.textContent = String(this.tenant.roomCount || 0);
    subscriberCountEl.textContent = String(this.tenant.subscriberCount || 0);
    revenueEl.textContent = `$${(this.tenant.monthlyRevenue || 0).toLocaleString()}`;
  }
}

customElements.define('tenant-card', TenantCard);
