/* global self, caches, clients, fetch, importScripts */
/**
 * TaskFlow service worker (PWA).
 *
 * - Web push handling lives in /sw-push.js and is imported below, so one registration serves both.
 * - Only same-origin GET requests are ever cached. API, Supabase, storage and realtime traffic are on
 *   other origins and are never touched, so data is always live and private files are never cached.
 * - index.html / page navigations are network-first (a new deploy is picked up immediately);
 *   if the network is down the branded offline page is shown.
 * - Hashed build assets (/assets/*) are cache-first: their names change on every build.
 * - Bump VERSION to drop every old cache.
 */
const VERSION = 'v1';
const STATIC_CACHE = `taskflow-static-${VERSION}`;
const ASSET_CACHE = `taskflow-assets-${VERSION}`;
const PRECACHE = [
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];
const NAVIGATION_TIMEOUT_MS = 8000;

importScripts('/sw-push.js');

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)));
  // The new worker waits until the user accepts the "Update available" prompt (see SKIP_WAITING below).
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC_CACHE, ASSET_CACHE]);
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith('taskflow-') && !keep.has(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

async function handleNavigation(request) {
  try {
    return await Promise.race([fetch(request), timeout(NAVIGATION_TIMEOUT_MS)]);
  } catch {
    const cache = await caches.open(STATIC_CACHE);
    return (await cache.match('/offline.html')) || new Response('You are offline.', { status: 503 });
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => hit);
  return hit || refresh;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // API, Supabase, storage, fonts: never cached
  if (url.pathname === '/sw.js' || url.pathname === '/sw-push.js') return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (url.pathname.startsWith('/icons/') || url.pathname === '/manifest.webmanifest' || url.pathname === '/task-logo.png') {
    event.respondWith(staleWhileRevalidate(request));
  }
});
