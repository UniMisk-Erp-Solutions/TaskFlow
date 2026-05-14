// Re-export the single source-of-truth theme provider so quest-style imports
// (`@/src/lib/ThemeContext`) keep working alongside dashboard-style imports
// (`../ThemeContext`).
export { ThemeProvider, useTheme, ThemeToggle } from "../ThemeContext.jsx";
