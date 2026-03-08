import './styles.css';
import './components/dale-header';
import './components/dale-footer';
import './pages/home';
import './pages/dashboard';
import './pages/subscribe';
import './pages/auth';
import { initAuth, isAuthenticated } from './services/auth';
import { route, initRouter, navigate } from './services/router';

function render(component: string, params?: Record<string, string>): void {
  const app = document.getElementById('app')!;

  app.innerHTML = `
    <dale-header></dale-header>
    <main id="main-content"></main>
    <dale-footer></dale-footer>
  `;

  const main = document.getElementById('main-content')!;
  const page = document.createElement(component);

  if (params && 'params' in (page as object)) {
    (page as HTMLElement & { params: Record<string, string> }).params = params;
  }

  main.appendChild(page);
}

function requireAuth(handler: (params: Record<string, string>) => void) {
  return (params: Record<string, string>) => {
    if (!isAuthenticated()) {
      navigate('/');
      return;
    }
    handler(params);
  };
}

route('/', () => render('home-page'));
route('/auth', () => render('auth-page'));
route('/dashboard', requireAuth(() => render('dashboard-page')));
route('/subscribe/:roomId', requireAuth((params) => render('subscribe-page', params)));

initAuth();
initRouter();
