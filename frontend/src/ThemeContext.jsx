import React, { createContext, useContext, useEffect, useMemo } from 'react';

/**
 * TaskFlow is always shown in its dark blue look; there is no light mode and no theme switch.
 *
 *   • `data-theme="dark"` on <html>  → dashboards (CSS vars `--tf-*`)
 *   • `class="dark"`        on <html>  → anything styled with Tailwind's dark variant
 *
 * `useTheme()` stays so components (for example the whiteboard) can still ask which theme is active.
 */

const THEME = 'dark';

const ThemeContext = createContext({
  theme: THEME,
  toggle: () => {},
  toggleTheme: () => {},
  setTheme: () => {},
});

function applyTheme() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', THEME);
  root.classList.remove('light');
  root.classList.add(THEME);
  root.style.colorScheme = THEME;
}

export function ThemeProvider({ children }) {
  applyTheme();
  useEffect(() => {
    applyTheme();
    // Forget any light-mode choice saved by an older version of the app.
    try {
      window.localStorage.removeItem('taskflow-theme');
      window.localStorage.removeItem('theme');
    } catch (_err) {
      // ignore (privacy mode etc.)
    }
  }, []);
  const value = useMemo(() => ({ theme: THEME, toggle: () => {}, toggleTheme: () => {}, setTheme: () => {} }), []);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
