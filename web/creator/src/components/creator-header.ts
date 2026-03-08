import { isAuthenticated, signIn, signOut, onAuthChange, getTenantInfo } from '../services/auth';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
    }

    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.5rem 2rem;
      background-color: var(--color-surface, #FFFFFF);
      border-bottom: 1px solid var(--color-border, #E8E4DC);
    }

    .logo {
      font-family: var(--font-serif, Georgia, serif);
      font-size: 1.5rem;
      font-weight: 400;
      color: var(--color-text, #2C2C2C);
      text-decoration: none;
      letter-spacing: -0.02em;
    }

    .logo-sub {
      font-family: var(--font-sans, system-ui, sans-serif);
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--color-accent, #8A9A7E);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-left: 0.5rem;
    }

    nav {
      display: flex;
      align-items: center;
      gap: 2rem;
    }

    .nav-link {
      font-family: var(--font-sans, system-ui, sans-serif);
      font-size: 0.9rem;
      color: var(--color-text-secondary, #5C5C5C);
      text-decoration: none;
      transition: color 0.35s cubic-bezier(0.25, 0.1, 0.25, 1);
    }

    .nav-link:hover {
      color: var(--color-accent, #8A9A7E);
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .tenant-name {
      font-size: 0.85rem;
      color: var(--color-text-muted, #8E8E8E);
    }

    .auth-btn {
      display: inline-flex;
      align-items: center;
      padding: 0.5rem 1rem;
      font-family: var(--font-sans, system-ui, sans-serif);
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--color-text-inverse, #F6F4EF);
      background-color: var(--color-text, #2C2C2C);
      border: none;
      border-radius: 9999px;
      cursor: pointer;
      transition: background-color 0.35s cubic-bezier(0.25, 0.1, 0.25, 1);
    }

    .auth-btn:hover {
      background-color: var(--color-text-secondary, #5C5C5C);
    }

    .auth-btn--secondary {
      background-color: transparent;
      color: var(--color-text, #2C2C2C);
      border: 1px solid var(--color-border, #E8E4DC);
    }

    .auth-btn--secondary:hover {
      border-color: var(--color-text, #2C2C2C);
    }

    @media (max-width: 768px) {
      header {
        padding: 1rem;
        flex-wrap: wrap;
        gap: 1rem;
      }

      nav {
        gap: 1rem;
        order: 3;
        width: 100%;
        justify-content: center;
      }
    }
  </style>
  <header>
    <a href="/" data-nav class="logo">Dalegram<span class="logo-sub">Creators</span></a>
    <nav class="nav-links" style="display: none;">
      <a href="/" data-nav class="nav-link">Dashboard</a>
      <a href="/rooms" data-nav class="nav-link">Rooms</a>
    </nav>
    <div class="user-info">
      <span class="tenant-name"></span>
      <button class="auth-btn auth-btn--signin">Sign In</button>
      <button class="auth-btn auth-btn--secondary auth-btn--signout" style="display: none;">Sign Out</button>
    </div>
  </header>
`;

export class CreatorHeader extends HTMLElement {
  private signInBtn!: HTMLButtonElement;
  private signOutBtn!: HTMLButtonElement;
  private navLinks!: HTMLElement;
  private tenantNameEl!: HTMLElement;
  private unsubscribe?: () => void;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.shadowRoot!.appendChild(template.content.cloneNode(true));

    this.signInBtn = this.shadowRoot!.querySelector('.auth-btn--signin')!;
    this.signOutBtn = this.shadowRoot!.querySelector('.auth-btn--signout')!;
    this.navLinks = this.shadowRoot!.querySelector('.nav-links')!;
    this.tenantNameEl = this.shadowRoot!.querySelector('.tenant-name')!;

    this.signInBtn.addEventListener('click', () => signIn());
    this.signOutBtn.addEventListener('click', () => signOut());

    this.updateAuthState();
    this.unsubscribe = onAuthChange(() => this.updateAuthState());
  }

  disconnectedCallback(): void {
    this.unsubscribe?.();
  }

  private updateAuthState(): void {
    const authenticated = isAuthenticated();
    const tenant = getTenantInfo();

    this.signInBtn.style.display = authenticated ? 'none' : 'inline-flex';
    this.signOutBtn.style.display = authenticated ? 'inline-flex' : 'none';
    this.navLinks.style.display = authenticated && tenant?.isOnboarded ? 'flex' : 'none';

    if (tenant?.displayName) {
      this.tenantNameEl.textContent = tenant.displayName;
      this.tenantNameEl.style.display = 'inline';
    } else {
      this.tenantNameEl.style.display = 'none';
    }
  }
}

customElements.define('creator-header', CreatorHeader);
