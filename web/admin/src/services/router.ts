type RouteHandler = (params: Record<string, string>) => void;

interface Route {
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
}

const routes: Route[] = [];
let currentPath = '';

export function route(path: string, handler: RouteHandler): void {
  const paramNames: string[] = [];
  const pattern = path.replace(/:([^/]+)/g, (_, name) => {
    paramNames.push(name);
    return '([^/]+)';
  });

  routes.push({
    pattern: new RegExp(`^${pattern}$`),
    paramNames,
    handler,
  });
}

export function navigate(path: string): void {
  if (path === currentPath) return;
  currentPath = path;
  window.history.pushState(null, '', path);
  matchRoute(path);
}

export function getCurrentPath(): string {
  return currentPath || window.location.pathname;
}

export function initRouter(): void {
  currentPath = window.location.pathname;

  window.addEventListener('popstate', () => {
    currentPath = window.location.pathname;
    matchRoute(currentPath);
  });

  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a[data-nav]');
    if (anchor) {
      e.preventDefault();
      const href = anchor.getAttribute('href');
      if (href) {
        navigate(href);
      }
    }
  });

  matchRoute(currentPath);
}

function matchRoute(path: string): void {
  for (const { pattern, paramNames, handler } of routes) {
    const match = path.match(pattern);
    if (match) {
      const params: Record<string, string> = {};
      paramNames.forEach((name, i) => {
        params[name] = match[i + 1];
      });
      handler(params);
      return;
    }
  }

  navigate('/');
}
