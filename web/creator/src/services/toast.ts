let toastContainer: HTMLElement | null = null;

function ensureContainer(): HTMLElement {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

export function showToast(
  message: string,
  type: 'info' | 'success' | 'error' = 'info',
  duration = 5000
): void {
  const container = ensureContainer();

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(1rem)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

export function showError(message: string): void {
  showToast(message, 'error');
}

export function showSuccess(message: string): void {
  showToast(message, 'success');
}
