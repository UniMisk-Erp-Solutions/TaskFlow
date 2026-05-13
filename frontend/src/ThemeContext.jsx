import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

/**
 * TaskFlow theme provider — pure CSS-variable driven (see `index.css`).
 *
 * Source of truth: the `data-theme` attribute on <html>. We toggle between
 * "light" and "dark" and persist the user's preference in localStorage.
 * If the user has not set a preference yet, we follow the OS via
 * `prefers-color-scheme`, and we keep listening so the UI follows the OS
 * until an explicit choice is made.
 *
 * No backend / route / DB surface is touched. Components that read CSS
 * variables (the entire UI) update automatically when `data-theme` flips.
 */

const STORAGE_KEY = 'taskflow-theme';

const ThemeContext = createContext({
  theme: 'light',
  toggle: () => {},
  setTheme: () => {},
});

function getInitialTheme() {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
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

  const value = useMemo(() => ({ theme, toggle, setTheme }), [theme, toggle, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * Compact icon button used in the Sidebar (light surface) and Navbar
 * (dark surface). The `onDark` flag swaps the chrome so the button stays
 * legible against TaskFlow's brand-navy global nav.
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
