import { isAuthenticated } from '../services/auth';
import { navigate } from '../services/router';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
    }

    .auth-page {
      min-height: 60vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 3rem 1.5rem;
    }

    .auth-card {
      text-align: center;
      padding: 3rem;
      background-color: var(--color-surface, #FFFFFF);
      border: 1px solid var(--color-border, #E8E4DC);
      border-radius: 16px;
      max-width: 400px;
    }

    h1 {
      font-family: var(--font-serif, Georgia, serif);
      font-size: 2rem;
      font-weight: 400;
      color: var(--color-text, #2C2C2C);
      margin: 0 0 0.5rem 0;
    }

    p {
      color: var(--color-text-secondary, #5C5C5C);
      margin: 0 0 1.5rem 0;
    }

    .spinner {
      width: 24px;
      height: 24px;
      border: 3px solid var(--color-border, #E8E4DC);
      border-top-color: var(--color-accent, #8A9A7E);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  </style>
  <section class="auth-page">
    <div class="auth-card">
      <h1>Authenticating...</h1>
      <p>Please wait while we complete your sign-in.</p>
      <div class="spinner"></div>
    </div>
  </section>
`;

export class AuthPage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.shadowRoot!.appendChild(template.content.cloneNode(true));

    setTimeout(() => {
      if (isAuthenticated()) {
        navigate('/');
      } else {
        navigate('/');
      }
    }, 500);
  }
}

customElements.define('auth-page', AuthPage);
