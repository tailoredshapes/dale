import { isAuthenticated, signIn, signOut, onAuthChange } from '../services/auth';

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
      background-color: var(--color-text, #2C2C2C);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .logo {
      font-family: var(--font-serif, Georgia, serif);
      font-size: 1.5rem;
      font-weight: 400;
      color: var(--color-text-inverse, #F6F4EF);
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
      color: rgba(255, 255, 255, 0.7);
      text-decoration: none;
      transition: color 0.35s cubic-bezier(0.25, 0.1, 0.25, 1);
    }

    .nav-link:hover {
      color: var(--color-accent, #8A9A7E);
    }

    .auth-btn {
      display: inline-flex;
      align-items: center;
      padding: 0.5rem 1rem;
      font-family: var(--font-sans, system-ui, sans-serif);
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--color-text, #2C2C2C);
      background-color: var(--color-accent, #8A9A7E);
      border: none;
      border-radius: 9999px;
      cursor: pointer;
      transition: background-color 0.35s cubic-bezier(0.25, 0.1, 0.25, 1);
    }

    .auth-btn:hover {
      background-color: var(--color-accent-hover, #7A8A6E);
    }

    .auth-btn--secondary {
      background-color: transparent;
      color: rgba(255, 255, 255, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .auth-btn--secondary:hover {
      border-color: rgba(255, 255, 255, 0.5);
      color: white;
    }

    @media (max-width: 768px) {
      header {
        padding: 1rem;
        flex-wrap: wrap;
        gap: 1rem;
      }

      nav {
        gap: 1rem;
      }
    }
  </style>
  <header>
    <a href="/" data-nav class="logo">Dalegram<span class="logo-sub">Admin</span></a>
    <nav class="nav-links" style="display: none;">
      <a href="/" data-nav class="nav-link">Dashboard</a>
      <a href="/tenants" data-nav class="nav-link">Tenants</a>
    </nav>
    <div>
      <button class="auth-btn auth-btn--signin">Sign In</button>
      <button class="auth-btn auth-btn--secondary auth-btn--signout" style="display: none;">Sign Out</button>
    </div>
  </header>
`;

export class AdminHeader extends HTMLElement {
  private signInBtn!: HTMLButtonElement;
  private signOutBtn!: HTMLButtonElement;
  private navLinks!: HTMLElement;
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
    this.signInBtn.style.display = authenticated ? 'none' : 'inline-flex';
    this.signOutBtn.style.display = authenticated ? 'inline-flex' : 'none';
    this.navLinks.style.display = authenticated ? 'flex' : 'none';
  }
}

customElements.define('admin-header', AdminHeader);
