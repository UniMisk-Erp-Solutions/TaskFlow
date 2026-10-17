/**
 * Registers the PWA service worker (/sw.js) in production builds only, so local dev never serves cached files.
 * Emits window events the UI listens to:
 *   - "taskflow:sw-update"  detail = ServiceWorkerRegistration with a waiting worker (new version ready)
 */
const UPDATE_CHECK_MS = 30 * 60 * 1000;

export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  if (import.meta.env.DEV && import.meta.env.VITE_PWA_DEV !== 'true') return;

  window.addEventListener('load', async () => {
    let registration;
    try {
      registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    } catch (error) {
      console.warn('[pwa] service worker registration failed', error);
      return;
    }

    const announce = () => {
      if (registration.waiting && navigator.serviceWorker.controller) {
        window.dispatchEvent(new CustomEvent('taskflow:sw-update', { detail: registration }));
      }
    };

    announce();
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed') announce();
      });
    });

    // Look for a new deploy periodically and whenever the app returns to the foreground.
    const check = () => registration.update().catch(() => {});
    window.setInterval(check, UPDATE_CHECK_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    });
  });
}
