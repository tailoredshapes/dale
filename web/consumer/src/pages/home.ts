import { getPublicRooms, Room } from '../services/api';
import '../components/room-card';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
    }

    .home {
      padding: 3rem 0;
    }

    .hero {
      text-align: center;
      margin-bottom: 4rem;
    }

    .hero h1 {
      font-family: var(--font-serif, Georgia, serif);
      font-size: 3rem;
      font-weight: 300;
      color: var(--color-text, #2C2C2C);
      margin: 0 0 1rem 0;
      letter-spacing: -0.02em;
    }

    .hero p {
      font-size: 1.125rem;
      color: var(--color-text-secondary, #5C5C5C);
      max-width: 600px;
      margin: 0 auto;
    }

    .rooms-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1.5rem;
      padding: 0 1.5rem;
      max-width: 1200px;
      margin: 0 auto;
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
      color: var(--color-text-muted, #8E8E8E);
    }

    .empty-state h2 {
      font-family: var(--font-serif, Georgia, serif);
      font-size: 1.5rem;
      color: var(--color-text, #2C2C2C);
      margin-bottom: 0.5rem;
    }

    .error {
      text-align: center;
      padding: 2rem;
      background-color: rgba(181, 112, 107, 0.08);
      color: #B5706B;
      border-radius: 8px;
      max-width: 600px;
      margin: 2rem auto;
    }

    @media (max-width: 768px) {
      .hero h1 {
        font-size: 2rem;
      }

      .rooms-grid {
        grid-template-columns: 1fr;
        padding: 0 1rem;
      }
    }
  </style>
  <section class="home">
    <div class="hero">
      <h1>Premium Telegram Communities</h1>
      <p>Join exclusive subscription-based groups run by your favorite creators.</p>
    </div>
    <div class="content">
      <div class="loading">
        <div class="spinner"></div>
      </div>
    </div>
  </section>
`;

export class HomePage extends HTMLElement {
  private rooms: Room[] = [];
  private loading = true;
  private error: string | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.shadowRoot!.appendChild(template.content.cloneNode(true));
    this.loadRooms();
  }

  private async loadRooms(): Promise<void> {
    try {
      this.rooms = await getPublicRooms();
      this.loading = false;
      this.render();
    } catch (err) {
      this.loading = false;
      this.error = 'Failed to load rooms. Please try again later.';
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

    if (this.rooms.length === 0) {
      contentEl.innerHTML = `
        <div class="empty-state">
          <h2>No rooms available</h2>
          <p>Check back later for new communities.</p>
        </div>
      `;
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'rooms-grid';

    this.rooms.forEach((room) => {
      const card = document.createElement('room-card') as HTMLElement & { data: Room };
      card.data = room;
      grid.appendChild(card);
    });

    contentEl.innerHTML = '';
    contentEl.appendChild(grid);
  }
}

customElements.define('home-page', HomePage);
