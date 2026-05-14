import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

/**
 * TaskFlow theme provider — drives both surfaces in lockstep:
 *
 *   • `data-theme="light" | "dark"` on <html>  → dashboard (CSS vars `--tf-*`)
 *   • `class="dark"`             on <html>  → marketing pages (Tailwind v4
 *                                              dark variant)
 *
 * The same provider exposes BOTH legacy (`theme`, `toggle`, `setTheme`) and
 * the names the imported quest landing pages expect (`toggleTheme`). User
 * preference persists under localStorage key `taskflow-theme`. If no
 * preference exists, we follow the OS via `prefers-color-scheme`.
 */

const STORAGE_KEY = 'taskflow-theme';

const ThemeContext = createContext({
  theme: 'light',
  toggle: () => {},
  toggleTheme: () => {},
  setTheme: () => {},
});

function getInitialTheme() {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    // legacy key from quest's standalone build, so users migrating in don't
    // get surprised by a reset.
    const legacy = window.localStorage.getItem('theme');
    if (legacy === 'light' || legacy === 'dark') return legacy;
  } catch (_err) {
    // ignore (privacy mode etc.)
  }
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.classList.remove('light', 'dark');
  root.classList.add(theme);
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    const t = getInitialTheme();
    applyTheme(t);
    return t;
  });
  const [userOverride, setUserOverride] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      return stored === 'light' || stored === 'dark';
    } catch (_err) {
      return false;
    }
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (userOverride) return undefined;
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => setThemeState(e.matches ? 'dark' : 'light');
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handler);
      else mq.removeListener(handler);
    };
  }, [userOverride]);

  const setTheme = useCallback((next) => {
    const value = next === 'dark' ? 'dark' : 'light';
    setThemeState(value);
    setUserOverride(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch (_err) {
      // ignore
    }
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  // `toggleTheme` is the name expected by the quest landing components.
  const value = useMemo(
    () => ({ theme, toggle, toggleTheme: toggle, setTheme }),
    [theme, toggle, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * Compact icon button used in the dashboard Sidebar (light surface) and
 * Navbar (dark surface). The `onDark` flag swaps the chrome so the button
 * stays legible against TaskFlow's brand-navy global nav.
 */
export function ThemeToggle({ onDark = false, size = 16, title }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';
  const label = isDark ? 'Switch to light theme' : 'Switch to dark theme';
  return (
    <button
      type="button"
      onClick={toggle}
      className={onDark ? 'tf-theme-toggle tf-theme-toggle-on-dark' : 'tf-theme-toggle'}
      aria-label={label}
      title={title || label}
    >
      {isDark ? <Sun size={size} strokeWidth={1.7} /> : <Moon size={size} strokeWidth={1.7} />}
    </button>
  );
}
