import { getRooms, Room } from '../services/api';
import '../components/room-list-item';
import '../components/room-form';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
    }

    .rooms-page {
      max-width: 1000px;
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

    .rooms-list {
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
      max-width: 600px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
    }
  </style>
  <section class="rooms-page">
    <div class="header">
      <h1>Rooms</h1>
      <button class="btn create-btn">Create Room</button>
    </div>
    <div class="content">
      <div class="loading">
        <div class="spinner"></div>
      </div>
    </div>
  </section>
`;

export class RoomsPage extends HTMLElement {
  private rooms: Room[] = [];
  private loading = true;
  private showForm = false;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.shadowRoot!.appendChild(template.content.cloneNode(true));

    const createBtn = this.shadowRoot!.querySelector('.create-btn')!;
    createBtn.addEventListener('click', () => this.openForm());

    this.shadowRoot!.addEventListener('saved', () => {
      this.closeForm();
      this.loadRooms();
    });

    this.shadowRoot!.addEventListener('cancel', () => this.closeForm());

    this.loadRooms();
  }

  private async loadRooms(): Promise<void> {
    this.loading = true;
    this.render();

    try {
      this.rooms = await getRooms();
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
        <room-form></room-form>
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

    if (this.rooms.length === 0) {
      contentEl.innerHTML = `
        <div class="empty-state">
          <h3>No rooms yet</h3>
          <p>Create your first room to start accepting subscribers.</p>
          <button class="btn first-room-btn">Create Your First Room</button>
        </div>
      `;

      const firstRoomBtn = contentEl.querySelector('.first-room-btn');
      firstRoomBtn?.addEventListener('click', () => this.openForm());
      return;
    }

    const list = document.createElement('div');
    list.className = 'rooms-list';

    this.rooms.forEach((room) => {
      const item = document.createElement('room-list-item') as HTMLElement & { data: Room };
      item.data = room;
      list.appendChild(item);
    });

    contentEl.innerHTML = '';
    contentEl.appendChild(list);
  }
}

customElements.define('rooms-page', RoomsPage);
