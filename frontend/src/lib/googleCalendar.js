/**
 * Google Calendar OAuth client (browser-only).
 *
 * Key implementation detail: the GIS token client is **pre-initialised** the
 * moment `accounts.google.com/gsi/client` finishes loading. That way the
 * "Sign in with Google" button can call `requestAccessToken()` synchronously
 * from inside the click handler — browsers (Safari especially) will only
 * open the OAuth popup if it comes from a direct user gesture, not after
 * an `await`. The previous lazy-init flow occasionally got blocked.
 *
 * Public API:
 *   isConfigured()            → boolean (VITE_GOOGLE_CLIENT_ID is set)
 *   isConnected(userId)       → boolean (cached token still valid)
 *   getConnectedEmail(userId) → string | null
 *   connect({ userId, prompt }) → Promise<token>
 *   disconnect({ userId })    → Promise<void>
 *   createEvent({ ... })      → Promise<Google event JSON>
 *   buildEventWindow(date, time, mins) → { startISO, endISO } | null
 */

const SCOPES = 'https://www.googleapis.com/auth/calendar.events';
const STORAGE_PREFIX = 'taskflow_gcal:';
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

function clientId() {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
}

export function isConfigured() {
  return Boolean(clientId());
}

function storageKey(userId) {
  return STORAGE_PREFIX + (userId || 'anon');
}

function readToken(userId) {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj?.access_token) return null;
    if (obj.expires_at && obj.expires_at < Date.now() + 30_000) return null;
    return obj;
  } catch {
    return null;
  }
}

function writeToken(userId, token) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(token));
  } catch {
    /* localStorage disabled — silently ignore */
  }
}

function clearToken(userId) {
  try {
    localStorage.removeItem(storageKey(userId));
  } catch {
    /* ignore */
  }
}

export function getConnectedEmail(userId) {
  return readToken(userId)?.email || null;
}

export function isConnected(userId) {
  return !!readToken(userId);
}

// ─── Pre-init the GIS token client as soon as the script loads ────────
// We keep ONE token client per session and reuse it. The `callback` is
// rebound on each requestAccessToken so each connect call gets its own
// resolve/reject.

let gisReadyPromise = null;
let _tokenClient = null;
let _pendingCallback = null;

function loadGis() {
  if (gisReadyPromise) return gisReadyPromise;
  gisReadyPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('No window'));
    if (window.google?.accounts?.oauth2) return resolve(window.google);

    const start = Date.now();
    const TIMEOUT = 10_000;

    (function tick() {
      if (window.google?.accounts?.oauth2) return resolve(window.google);
      if (Date.now() - start > TIMEOUT) {
        return reject(new Error(
          'Google sign-in could not load. Check your network connection (a script on accounts.google.com is blocked) and reload the page.',
        ));
      }
      setTimeout(tick, 100);
    })();
  });
  return gisReadyPromise;
}

function ensureTokenClient() {
  if (_tokenClient) return _tokenClient;
  if (!window.google?.accounts?.oauth2) return null;
  if (!clientId()) return null;

  _tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId(),
    scope: SCOPES,
    callback: (resp) => {
      // Re-dispatched per call via _pendingCallback.
      if (_pendingCallback) {
        const cb = _pendingCallback;
        _pendingCallback = null;
        cb(resp);
      }
    },
    error_callback: (err) => {
      if (_pendingCallback) {
        const cb = _pendingCallback;
        _pendingCallback = null;
        cb({ error: err?.type || 'error', error_description: err?.message || 'Google sign-in was cancelled.' });
      }
    },
  });
  return _tokenClient;
}

// Best-effort pre-initialise on module load. If GIS isn't there yet, retry
// once it loads. We swallow errors here — the click handler will surface
// them via the same loadGis()/ensureTokenClient() pair.
if (typeof window !== 'undefined' && clientId()) {
  loadGis().then(() => { try { ensureTokenClient(); } catch { /* */ } }).catch(() => { /* */ });
}

/**
 * Connect. Must be called **synchronously** from a user gesture (button
 * onClick handler). If GIS isn't loaded yet, we still try; the popup may
 * be blocked on first load — the user can click again.
 */
export function connect({ userId, prompt = 'consent' } = {}) {
  return new Promise((resolve, reject) => {
    if (!clientId()) {
      return reject(new Error('VITE_GOOGLE_CLIENT_ID is not set. Add it to frontend/.env and rebuild.'));
    }
    const start = () => {
      const tc = ensureTokenClient();
      if (!tc) {
        return reject(new Error('Google sign-in is still loading. Please click again in a moment.'));
      }
      _pendingCallback = async (resp) => {
        if (resp.error) {
          return reject(new Error(resp.error_description || resp.error));
        }
        const token = {
          access_token: resp.access_token,
          expires_at: Date.now() + (Number(resp.expires_in) || 3600) * 1000,
          scope: resp.scope,
          email: null,
        };
        try {
          const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${token.access_token}` },
          });
          if (r.ok) {
            const u = await r.json();
            token.email = u.email || null;
          }
        } catch { /* non-critical */ }
        writeToken(userId, token);
        resolve(token);
      };
      try {
        tc.requestAccessToken({ prompt });
      } catch (e) {
        _pendingCallback = null;
        reject(e);
      }
    };

    // If GIS already loaded, fire synchronously (keeps popup unblocked).
    // Otherwise wait briefly then fire — popup may be blocked once but
    // the second click will succeed because GIS is now in memory.
    if (window.google?.accounts?.oauth2) {
      start();
    } else {
      loadGis().then(start).catch(reject);
    }
  });
}

/** Disconnect — revoke + clear local cache. */
export async function disconnect({ userId } = {}) {
  const tok = readToken(userId);
  clearToken(userId);
  if (!tok?.access_token || !window.google?.accounts?.oauth2) return;
  try {
    window.google.accounts.oauth2.revoke(tok.access_token, () => {});
  } catch { /* ignore */ }
}

/** Internal: ensure a valid token, prompt user if needed. */
async function getValidToken(userId) {
  const cached = readToken(userId);
  if (cached) return cached;
  // No popup-allowed click context here — try silent refresh with prompt: ''.
  return connect({ userId, prompt: '' });
}

/**
 * Public: ensure a valid token, CALLED FROM A USER GESTURE (button click).
 * If the cached token is still valid it returns immediately; otherwise it
 * opens the Google popup (silent if the user is still signed in). Use this at
 * the very start of a submit handler so the popup isn't blocked.
 */
export async function ensureToken(userId) {
  const cached = readToken(userId);
  if (cached) return cached;
  // Try silent first; if that throws (no active session / consent), fall back
  // to an interactive popup which is allowed because we're in a click gesture.
  try {
    return await connect({ userId, prompt: '' });
  } catch {
    return connect({ userId, prompt: 'consent' });
  }
}

/** Create an event on the user's primary Google Calendar. */
export async function createEvent(input) {
  const { userId, summary, description, startISO, endISO, allDayDate, attendees, location } = input;
  const token = await getValidToken(userId);

  // All-day event when only a date (no time) is available; otherwise a timed
  // event. Google requires the all-day `end.date` to be the day AFTER.
  let timing;
  if (allDayDate) {
    const [y, m, d] = allDayDate.split('-').map(Number);
    const next = new Date(y, m - 1, d + 1);
    const nextStr = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
    timing = { start: { date: allDayDate }, end: { date: nextStr } };
  } else {
    timing = { start: { dateTime: startISO }, end: { dateTime: endISO } };
  }

  const body = {
    summary: summary || 'Untitled meeting',
    description: description || '',
    ...timing,
    ...(location ? { location } : {}),
    ...(attendees?.length
      ? { attendees: attendees.filter(Boolean).map((email) => ({ email })) }
      : {}),
    reminders: { useDefault: true },
  };

  const r = await fetch(`${CALENDAR_API}/calendars/primary/events?sendUpdates=all`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    let detail = '';
    try {
      const j = await r.json();
      detail = j?.error?.message || '';
    } catch { /* ignore */ }
    throw new Error(`Google Calendar refused the event (${r.status})${detail ? `: ${detail}` : ''}`);
  }

  return r.json();
}

/** Combine yyyy-mm-dd + HH:MM into an ISO timestamp pair (1 hour default). */
export function buildEventWindow(dateStr, timeStr, durationMinutes = 60) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const tm = (timeStr || '09:00').match(/^(\d{2}):(\d{2})/);
  const hh = tm ? Number(tm[1]) : 9;
  const mm = tm ? Number(tm[2]) : 0;
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const start = new Date(y, m - 1, d, hh, mm, 0);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}
