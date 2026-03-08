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
  </style>
  <footer>
    <p>&copy; ${new Date().getFullYear()} Dalegram Admin. Platform management.</p>
  </footer>
`;

export class AdminFooter extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.shadowRoot!.appendChild(template.content.cloneNode(true));
  }
}

customElements.define('admin-footer', AdminFooter);
