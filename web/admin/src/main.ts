import './styles.css';
import './components/admin-header';
import './components/admin-footer';
import './pages/dashboard';
import './pages/tenants';
import './pages/tenant-detail';
import './pages/auth';
import { initAuth, isAuthenticated } from './services/auth';
import { route, initRouter, navigate } from './services/router';

function render(component: string, params?: Record<string, string>): void {
  const app = document.getElementById('app')!;

  app.innerHTML = `
    <admin-header></admin-header>
    <main id="main-content"></main>
    <admin-footer></admin-footer>
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

route('/', () => render('dashboard-page'));
route('/auth', () => render('auth-page'));
route('/tenants', requireAuth(() => render('tenants-page')));
route('/tenants/:id', requireAuth((params) => render('tenant-detail-page', params)));

initAuth();
initRouter();
