/* global self, clients */
self.addEventListener('push', (event) => {
  let payload = { title: 'TaskFlow', body: '', data: { url: '/' } };
  try {
    if (event.data) {
      const j = event.data.json();
      payload = {
        title: j.title || 'TaskFlow',
        body: j.body || '',
        data: j.data || { url: '/' },
      };
    }
  } catch {
    /* use defaults */
  }
  const title = payload.title;
  const options = {
    body: payload.body,
    data: payload.data,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url =
    typeof event.notification.data === 'object' && event.notification.data && event.notification.data.url
      ? event.notification.data.url
      : '/';
  event.waitUntil(
    (async () => {
      const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const target = typeof url === 'string' ? url : '/';
      for (const c of list) {
        if ('focus' in c) {
          if (c.navigate) await c.navigate(target);
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })(),
  );
});
