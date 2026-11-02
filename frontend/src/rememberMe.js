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
