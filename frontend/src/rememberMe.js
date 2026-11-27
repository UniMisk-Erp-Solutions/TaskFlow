// "Remember me" on the sign-in screen.
//
// Ticked (the default): the session is kept in localStorage, so the person stays signed in across browser restarts (up to the
// server's session limit, 7 days). Not ticked: the session is kept in sessionStorage, so it ends when the browser tab/window is
// closed. The choice is stored under REMEMBER_KEY, and the email is remembered for the next visit only while it is ticked.

const REMEMBER_KEY = 'taskflow-remember-me';
const EMAIL_KEY = 'taskflow-remembered-email';

const safe = (fn, fallback = null) => {
  try {
    return fn();
  } catch {
    return fallback; // storage can be blocked (private mode, strict settings): behave as if it were empty
  }
};

export function getRememberMe() {
  if (typeof window === 'undefined') return true;
  return safe(() => window.localStorage.getItem(REMEMBER_KEY), '1') !== '0';
}

export function setRememberMe(remember) {
  if (typeof window === 'undefined') return;
  safe(() => window.localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0'));
}

export function getRememberedEmail() {
  if (typeof window === 'undefined' || !getRememberMe()) return '';
  return safe(() => window.localStorage.getItem(EMAIL_KEY), '') || '';
}

/** Remember (or forget) the email typed on the sign-in screen. */
export function rememberEmail(email, remember) {
  if (typeof window === 'undefined') return;
  safe(() => (remember && email ? window.localStorage.setItem(EMAIL_KEY, email) : window.localStorage.removeItem(EMAIL_KEY)));
}

/**
 * Storage for the Supabase session. Reads look in both places (so an existing session is never lost); writes go to
 * localStorage when "Remember me" is on and to sessionStorage when it is off, and clear the other one.
 */
export const sessionStorageAdapter = {
  getItem(key) {
    if (typeof window === 'undefined') return null;
    return safe(() => window.localStorage.getItem(key)) ?? safe(() => window.sessionStorage.getItem(key));
  },
  setItem(key, value) {
    if (typeof window === 'undefined') return;
    if (getRememberMe()) {
      safe(() => window.localStorage.setItem(key, value));
      safe(() => window.sessionStorage.removeItem(key));
    } else {
      safe(() => window.sessionStorage.setItem(key, value));
      safe(() => window.localStorage.removeItem(key));
    }
  },
  removeItem(key) {
    if (typeof window === 'undefined') return;
    safe(() => window.localStorage.removeItem(key));
    safe(() => window.sessionStorage.removeItem(key));
  },
};

// ── A week-long session ──────────────────────────────────────────────────────────────────────────────────────────
// People stay signed in while they use TaskFlow: each visit renews the week. After SESSION_DAYS without opening the app the
// next visit asks for a sign-in again. (The server also expires idle sessions; see supabase/config.toml [auth.sessions].)
export const SESSION_DAYS = 7;
const ACTIVE_KEY = 'taskflow-last-active';
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/** True when the person last used the app more than SESSION_DAYS ago. No record (a new browser, or an older session) is not expired. */
export function sessionIdleExpired(now = Date.now()) {
  if (typeof window === 'undefined') return false;
  const last = Number(safe(() => window.localStorage.getItem(ACTIVE_KEY), 0));
  return Boolean(last) && now - last > SESSION_DAYS * DAY_MS;
}

/** Record that the app is in use. Written at most once an hour so it costs nothing. */
export function touchSession(now = Date.now()) {
  if (typeof window === 'undefined') return;
  const last = Number(safe(() => window.localStorage.getItem(ACTIVE_KEY), 0));
  if (!last || now - last > HOUR_MS) safe(() => window.localStorage.setItem(ACTIVE_KEY, String(now)));
}

export function clearSessionActivity() {
  if (typeof window === 'undefined') return;
  safe(() => window.localStorage.removeItem(ACTIVE_KEY));
}
