# Progressive Web App (Install TaskFlow on Android, iOS and Desktop)

## Purpose

TaskFlow can be installed from the browser to the home screen of Android and iOS phones (and desktop Chrome/Edge). It opens full-screen like a native app, has its own icon, shows a branded offline page, and keeps working with web push notifications. No app store is involved.

## How users install it

- **Android (Chrome, Edge, Samsung Internet):** after signing in, an **Install TaskFlow** banner appears; tap **Install**. (Browser menu -> *Install app* also works.)
- **iPhone / iPad (Safari):** iOS has no install prompt API, so after sign-in a banner shows the steps: tap **Share**, then **Add to Home Screen**.
- **Desktop Chrome/Edge:** install icon in the address bar, or the same banner.
- The banner is hidden once installed and, if dismissed, is not shown again for 14 days. It never appears before sign-in or on the marketing pages.

## What was added (`frontend/`)

| File | Role |
|---|---|
| `public/manifest.webmanifest` | App name, `standalone` display, theme colour `#5645d4`, start URL `/app?source=pwa` (routes to the right portal or the login page), icons |
| `public/icons/*` | 192/512 icons, 192/512 **maskable** icons (logo inside the safe zone), 180 px `apple-touch-icon`, 32 px favicon. Regenerate with `python scripts/generate-pwa-icons.py` (needs Pillow) from `public/task-logo.png` |
| `public/sw.js` | Service worker (see below) |
| `public/offline.html` | Branded offline page with a retry button; follows light/dark mode |
| `public/sw-push.js` | Existing web-push handlers, now imported by `sw.js`; notifications use the new icons |
| `src/pwa/registerSW.js` | Registers `/sw.js` (production builds only), checks for updates every 30 minutes and when the app returns to the foreground |
| `src/components/PwaPrompt.jsx` | Install banner, iOS instructions, "new version ready" prompt, offline strip. Mounted in `App.jsx` |
| `index.html` | Manifest link, light/dark `theme-color`, Apple web-app meta tags, apple-touch-icon |
| `vercel.json`, `render.yaml` | Headers so `sw.js`/`sw-push.js` are never cached by the host and the manifest has the right content type |
| `src/index.css` | Small installed-app polish (no tap highlight, no pull-to-refresh bounce in standalone) |

## Service worker behaviour

- **One registration** (`/sw.js`, scope `/`) serves both PWA caching and web push. `NotificationSettings.jsx` now registers `/sw.js`; devices that registered the old `/sw-push.js` are upgraded automatically.
- **Only same-origin GET requests are cached.** API calls, Supabase (auth, REST, Realtime, storage) and signed file URLs are cross-origin and are never cached, so data is always live and private files are never stored by the worker.
- **Pages** (navigations): network-first; if the network is down the offline page is shown. A new deploy is therefore picked up immediately.
- **`/assets/*`** (content-hashed build files): cache-first. **Icons/manifest**: stale-while-revalidate.
- **Updates:** a new worker waits; users see "A new version of TaskFlow is ready" and press **Update** to reload onto it. Bump `VERSION` in `sw.js` to purge all old caches.
- Registration is skipped in `vite dev` so local development never serves cached files. To test: `npm run build && npm run preview` (service workers work on `localhost`), or set `VITE_PWA_DEV=true`.

## Requirements and limits

- The site must be served over **HTTPS** (or `localhost`) for install, service workers and push. Production already is (`taskflow-backend.unimisk.com` for the API; serve the frontend over HTTPS too).
- The app is **online-first**: offline you get the offline page (and an "offline" strip if the app is already open). Offline data editing/sync is not included.
- iOS web push requires the app to be **added to the Home Screen** (iOS 16.4+) before notifications can be enabled in Notification settings.
- Installed apps show whichever web build is deployed; there is nothing to re-install for updates.
- Voice recording in chat works in the installed app (HTTPS); it does not work on plain `http://<ip>` pages.

## Verification performed

Production build + `vite preview`: manifest parsed (name, standalone, start URL), all four icons served as `image/png`, `sw.js` registered with scope `/` and controlling the page, precache populated, `theme-color` and apple-touch-icon present, and with the server stopped a navigation returned the offline page. Not tested on physical Android/iOS devices.

## Rollback

Remove `registerServiceWorker()` from `main.jsx` and `<PwaPrompt />` from `App.jsx`. Existing installs keep a dormant worker; to remove it for everyone, deploy a `sw.js` that unregisters itself (`self.registration.unregister()` on activate).
