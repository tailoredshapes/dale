import { getTenants, Tenant } from '../services/api';
import '../components/tenant-card';
import '../components/tenant-form';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
    }

    .tenants-page {
      max-width: 1200px;
      margin: 0 auto;
      padding: 3rem 1.5rem;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 2rem;
    }

    .header h1 {
      font-family: var(--font-serif, Georgia, serif);
      font-size: 2rem;
      font-weight: 400;
      color: var(--color-text, #2C2C2C);
      margin: 0;
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
      padding: 4rem;
      background-color: var(--color-surface, #FFFFFF);
      border: 1px solid var(--color-border, #E8E4DC);
      border-radius: 16px;
    }

    .empty-state h3 {
      font-family: var(--font-serif, Georgia, serif);
      font-size: 1.5rem;
      color: var(--color-text, #2C2C2C);
      margin: 0 0 0.5rem 0;
    }

    .empty-state p {
      color: var(--color-text-muted, #8E8E8E);
      margin: 0 0 1.5rem 0;
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
      max-width: 500px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
    }
  </style>
  <section class="tenants-page">
    <div class="header">
      <h1>Tenants</h1>
      <button class="btn onboard-btn">Onboard Tenant</button>
    </div>
    <div class="content">
      <div class="loading">
        <div class="spinner"></div>
      </div>
    </div>
  </section>
`;

export class TenantsPage extends HTMLElement {
  private tenants: Tenant[] = [];
  private loading = true;
  private showForm = false;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.shadowRoot!.appendChild(template.content.cloneNode(true));

    const onboardBtn = this.shadowRoot!.querySelector('.onboard-btn')!;
    onboardBtn.addEventListener('click', () => this.openForm());

    this.shadowRoot!.addEventListener('saved', () => {
      this.closeForm();
      this.loadTenants();
    });

    this.shadowRoot!.addEventListener('cancel', () => this.closeForm());

    this.loadTenants();
  }

  private async loadTenants(): Promise<void> {
    this.loading = true;
    this.render();

    try {
      this.tenants = await getTenants();
      this.loading = false;
      this.render();
    } catch (err) {
      this.loading = false;
      this.render();
    }
  }

  private openForm(): void {
    this.showForm = true;
    this.renderForm();
  }

  private closeForm(): void {
    this.showForm = false;
    const overlay = this.shadowRoot!.querySelector('.form-overlay');
    overlay?.remove();
  }

  private renderForm(): void {
    if (!this.showForm) return;

    const overlay = document.createElement('div');
    overlay.className = 'form-overlay';
    overlay.innerHTML = `
      <div class="form-container">
        <tenant-form></tenant-form>
      </div>
    `;

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.closeForm();
      }
    });

    this.shadowRoot!.appendChild(overlay);
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

    if (this.tenants.length === 0) {
      contentEl.innerHTML = `
        <div class="empty-state">
          <h3>No tenants yet</h3>
          <p>Onboard your first creator to get started.</p>
          <button class="btn first-tenant-btn">Onboard First Tenant</button>
        </div>
      `;

      const firstBtn = contentEl.querySelector('.first-tenant-btn');
      firstBtn?.addEventListener('click', () => this.openForm());
      return;
    }

    const list = document.createElement('div');
    list.className = 'tenants-list';

    this.tenants.forEach((tenant) => {
      const card = document.createElement('tenant-card') as HTMLElement & { data: Tenant };
      card.data = tenant;
      list.appendChild(card);
    });

    contentEl.innerHTML = '';
    contentEl.appendChild(list);
  }
}

customElements.define('tenants-page', TenantsPage);
