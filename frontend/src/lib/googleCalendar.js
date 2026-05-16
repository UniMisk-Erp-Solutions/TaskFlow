/**
 * Google Calendar OAuth client (browser-only, no server changes required).
 *
 * Flow used: **GIS Token Client** (Google Identity Services). The user clicks
 * "Connect Google Calendar" → a Google consent popup appears → we receive a
 * short-lived access_token (~1 hour) which is cached in localStorage. The
 * token is automatically refreshed on demand via a silent re-prompt as long
 * as the user remains signed into Google in this browser.
 *
 *   • No client secret is shipped (this is a public Web app OAuth client).
 *   • Tokens never go through TaskFlow's backend.
 *   • Each TaskFlow profile gets its own cache key so two people sharing a
 *     device don't accidentally inherit each other's calendar.
 *
 * Setup (see SETUP.md in the repo root for the exact Google Cloud Console
 * steps): set VITE_GOOGLE_CLIENT_ID in frontend/.env to a Web-app OAuth
 * client whose authorized JavaScript origin is your frontend URL.
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

/**
 * Wait until window.google.accounts.oauth2 is available. The script is
 * loaded asynchronously from a <script> tag in index.html; we poll briefly
 * so this works on first paint without ordering assumptions.
 */
function waitForGis(timeout = 6000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    function tick() {
      if (window.google?.accounts?.oauth2) return resolve(window.google);
      if (Date.now() - start > timeout) return reject(new Error('Google Identity Services failed to load. Check your network or VITE_GOOGLE_CLIENT_ID.'));
      setTimeout(tick, 100);
    }
    tick();
  });
}

/**
 * Trigger the consent popup and return a token bundle on success.
 * @param {{ userId: string, prompt?: 'consent' | '' }} opts
 */
export async function connect({ userId, prompt = 'consent' } = {}) {
  if (!clientId()) {
    throw new Error('VITE_GOOGLE_CLIENT_ID is not set. Add it to frontend/.env.');
  }
  const google = await waitForGis();

  return new Promise((resolve, reject) => {
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId(),
      scope: SCOPES,
      prompt,
      callback: async (resp) => {
        if (resp.error) return reject(new Error(resp.error_description || resp.error));
        const token = {
          access_token: resp.access_token,
          expires_at: Date.now() + (Number(resp.expires_in) || 3600) * 1000,
          scope: resp.scope,
          email: null,
        };
        // Fetch the connected Gmail address for display purposes.
        try {
          const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${token.access_token}` },
          });
          if (r.ok) {
            const u = await r.json();
            token.email = u.email || null;
          }
        } catch {
          /* not critical */
        }
        writeToken(userId, token);
        resolve(token);
      },
      error_callback: (err) => reject(new Error(err?.message || 'Google sign-in was cancelled.')),
    });
    tokenClient.requestAccessToken({ prompt });
  });
}

/** Disconnect: revoke the cached token (so the user can pick a different account). */
export async function disconnect({ userId } = {}) {
  const tok = readToken(userId);
  clearToken(userId);
  if (!tok?.access_token || !window.google?.accounts?.oauth2) return;
  try {
    window.google.accounts.oauth2.revoke(tok.access_token, () => {});
  } catch {
    /* ignore */
  }
}

/**
 * Ensure we have a valid token; if expired, transparently re-prompt the user
 * (no consent screen if they're still signed into Google).
 */
async function getValidToken(userId) {
  const cached = readToken(userId);
  if (cached) return cached;
  return connect({ userId, prompt: '' });
}

/**
 * Create a Google Calendar event on the user's primary calendar.
 *
 * @param {{
 *   userId: string,
 *   summary: string,
 *   description?: string,
 *   startISO: string,
 *   endISO: string,
 *   attendees?: string[], // email addresses
 *   location?: string,
 * }} input
 * @returns {Promise<{ id: string, htmlLink: string }>}
 */
export async function createEvent(input) {
  const { userId, summary, description, startISO, endISO, attendees, location } = input;
  const token = await getValidToken(userId);

  const body = {
    summary: summary || 'Untitled meeting',
    description: description || '',
    start: { dateTime: startISO },
    end: { dateTime: endISO },
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

/**
 * Combine a yyyy-mm-dd date + HH:MM[:SS] time into an ISO timestamp at local
 * time. Returns { startISO, endISO } where endISO is +1 hour by default.
 */
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
