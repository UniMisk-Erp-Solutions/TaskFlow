import type { CSSProperties } from "react";

/**
 * Colour sets for the public pages. Every colour on the marketing pages comes from these CSS variables, so setting
 * them on a wrapper re-themes everything inside it (cards, buttons, text) without touching the rest of the site.
 * The layout, navbar and footer all use the same set, so a page reads as one piece. The public pages are always dark.
 */
export const HOME_DARK_VARS = {
  "--background": "#030303",
  "--foreground": "#f1f5f9",
  "--card": "rgba(255, 255, 255, 0.055)",
  "--card-foreground": "#f1f5f9",
  "--border": "rgba(148, 163, 184, 0.18)",
  "--muted": "#94a3b8",
  "--accent": "rgba(255, 255, 255, 0.07)",
  "--wordmark": "#ffffff",
  "--wordmark-glow": "rgba(190, 170, 255, 0.35)",
  "--scrim": "rgba(3, 3, 3, 0.82)",
  "--nav-bg": "rgba(10, 10, 10, 0.6)",
  "--nav-bg-solid": "rgba(10, 10, 10, 0.78)",
  "--glass-edge": "rgba(255, 255, 255, 0.13)",
  "--glass-shine": "rgba(255, 255, 255, 0.14)",
  "--glass-shadow": "rgba(0, 0, 0, 0.7)",
} as CSSProperties;
