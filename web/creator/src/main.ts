import './styles.css';
import './components/creator-header';
import './components/creator-footer';
import './pages/dashboard';
import './pages/onboarding';
import './pages/rooms';
import './pages/room-detail';
import './pages/auth';
import { initAuth, isAuthenticated, isOnboarded } from './services/auth';
import { route, initRouter, navigate } from './services/router';

function render(component: string, params?: Record<string, string>): void {
  const app = document.getElementById('app')!;

  app.innerHTML = `
    <creator-header></creator-header>
    <main id="main-content"></main>
    <creator-footer></creator-footer>
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

function requireOnboarded(handler: (params: Record<string, string>) => void) {
  return (params: Record<string, string>) => {
    if (!isAuthenticated()) {
      navigate('/');
      return;
    }
    if (!isOnboarded()) {
      navigate('/onboarding');
      return;
    }
    handler(params);
  };
}

route('/', () => {
  if (isAuthenticated() && isOnboarded()) {
    render('dashboard-page');
  } else if (isAuthenticated()) {
    navigate('/onboarding');
  } else {
    render('dashboard-page');
  }
});

route('/auth', () => render('auth-page'));
route('/onboarding', requireAuth(() => render('onboarding-page')));
route('/rooms', requireOnboarded(() => render('rooms-page')));
route('/rooms/:id', requireOnboarded((params) => render('room-detail-page', params)));

initAuth();
initRouter();
