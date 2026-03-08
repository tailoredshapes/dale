const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
    }

    footer {
      padding: 2rem;
      text-align: center;
      color: var(--color-text-muted, #8E8E8E);
      font-size: 0.85rem;
      border-top: 1px solid var(--color-border, #E8E4DC);
      margin-top: auto;
    }

    footer p {
      margin: 0;
    }

    footer a {
      color: var(--color-accent, #8A9A7E);
      text-decoration: none;
    }

    footer a:hover {
      text-decoration: underline;
    }
  </style>
  <footer>
    <p>&copy; ${new Date().getFullYear()} Dalegram. Premium Telegram communities.</p>
  </footer>
`;

export class DaleFooter extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.shadowRoot!.appendChild(template.content.cloneNode(true));
  }
}

customElements.define('dale-footer', DaleFooter);
