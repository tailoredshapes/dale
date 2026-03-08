import { getSubscriptions, Subscription } from '../services/api';
import '../components/subscription-card';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
    }

    .dashboard {
      max-width: 800px;
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

    .subscriptions-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
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
      padding: 4rem 1.5rem;
      background-color: var(--color-surface, #FFFFFF);
      border: 1px solid var(--color-border, #E8E4DC);
      border-radius: 16px;
    }

    .empty-state h2 {
      font-family: var(--font-serif, Georgia, serif);
      font-size: 1.5rem;
      color: var(--color-text, #2C2C2C);
      margin: 0 0 0.5rem 0;
    }

    .empty-state p {
      color: var(--color-text-muted, #8E8E8E);
      margin: 0 0 1.5rem 0;
    }

    .browse-btn {
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

    .browse-btn:hover {
      background-color: var(--color-accent-hover, #7A8A6E);
    }

    .error {
      text-align: center;
      padding: 2rem;
      background-color: rgba(181, 112, 107, 0.08);
      color: #B5706B;
      border-radius: 8px;
    }
  </style>
  <section class="dashboard">
    <div class="header">
      <h1>My Subscriptions</h1>
      <p>Manage your active subscriptions and access your communities.</p>
    </div>
    <div class="content">
      <div class="loading">
        <div class="spinner"></div>
      </div>
    </div>
  </section>
`;

export class DashboardPage extends HTMLElement {
  private subscriptions: Subscription[] = [];
  private loading = true;
  private error: string | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.shadowRoot!.appendChild(template.content.cloneNode(true));
    this.loadSubscriptions();

    this.addEventListener('subscription-cancelled', () => {
      this.loadSubscriptions();
    });
  }

  private async loadSubscriptions(): Promise<void> {
    this.loading = true;
    this.render();

    try {
      this.subscriptions = await getSubscriptions();
      this.loading = false;
      this.render();
    } catch (err) {
      this.loading = false;
      this.error = 'Failed to load subscriptions. Please try again later.';
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

    if (this.error) {
      contentEl.innerHTML = `<div class="error">${this.error}</div>`;
      return;
    }

    if (this.subscriptions.length === 0) {
      contentEl.innerHTML = `
        <div class="empty-state">
          <h2>No subscriptions yet</h2>
          <p>Browse available rooms and subscribe to join exclusive communities.</p>
          <a href="/" data-nav class="browse-btn">Browse Rooms</a>
        </div>
      `;
      return;
    }

    const list = document.createElement('div');
    list.className = 'subscriptions-list';

    this.subscriptions.forEach((subscription) => {
      const card = document.createElement('subscription-card') as HTMLElement & { data: Subscription };
      card.data = subscription;
      list.appendChild(card);
    });

    contentEl.innerHTML = '';
    contentEl.appendChild(list);
  }
}

customElements.define('dashboard-page', DashboardPage);
