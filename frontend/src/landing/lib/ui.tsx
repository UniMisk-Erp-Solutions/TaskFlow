import type { ReactNode, CSSProperties } from "react";

/**
 * Shared **inline-style** primitives for every marketing landing page.
 *
 * Why inline? Because production caches in the deploy path were silently
 * serving stale Tailwind bundles, leaving pages "Tailwind-broken" — all
 * grid/flex utilities no-op'd, cards collapsed, headings drifted out of
 * alignment. Encoding structural layout in inline React styles ships the
 * layout *inside the JS bundle* (which Vite content-hashes), so no CDN
 * can serve a half-working version.
 *
 * Colours still resolve via CSS variables (--background, --foreground,
 * --muted, --card, --border) declared in both index.html's critical CSS
 * and src/index.css's @theme block, so light/dark theme still flips.
 */

export const BRAND = "#8B5CF6";
export const BRAND_ACCENT = "#C084FC";

export const tone = {
  bg: "var(--background)",
  fg: "var(--foreground)",
  muted: "var(--muted)",
  card: "var(--card)",
  border: "var(--border)",
  accent: "var(--accent)",
};

export const display: CSSProperties = {
  fontFamily: '"Plus Jakarta Sans", "Inter", system-ui, sans-serif',
  letterSpacing: "-0.025em",
};

// ─── Page shell ────────────────────────────────────────────────────────
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: tone.bg,
        color: tone.fg,
        paddingTop: 112,
        paddingBottom: 96,
        minHeight: "100vh",
      }}
    >
      {children}
    </div>
  );
}

// ─── Container (centered, max width) ───────────────────────────────────
export function Container({
  children,
  width = 1120,
  style,
}: {
  children: ReactNode;
  width?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        maxWidth: width,
        margin: "0 auto",
        padding: "0 24px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── Section (vertical rhythm) ─────────────────────────────────────────
export function Section({
  children,
  style,
  pad = "default",
}: {
  children: ReactNode;
  style?: CSSProperties;
  pad?: "tight" | "default" | "loose";
}) {
  const v = pad === "tight" ? 64 : pad === "loose" ? 96 : 80;
  return (
    <section
      style={{
        background: tone.bg,
        paddingTop: v,
        paddingBottom: v,
        ...style,
      }}
    >
      {children}
    </section>
  );
}

// ─── Eyebrow ───────────────────────────────────────────────────────────
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: BRAND,
        margin: 0,
      }}
    >
      {children}
    </p>
  );
}

// ─── Page header (eyebrow + h1 + lead) ─────────────────────────────────
export function PageHeader({
  eyebrow,
  title,
  blurb,
  align = "center",
}: {
  eyebrow?: string;
  title: ReactNode;
  blurb?: ReactNode;
  align?: "center" | "left";
}) {
  return (
    <header
      style={{
        textAlign: align,
        maxWidth: align === "center" ? 760 : "none",
        margin: align === "center" ? "0 auto 64px" : "0 0 64px",
        display: "flex",
        flexDirection: "column",
        gap: 20,
        alignItems: align === "center" ? "center" : "flex-start",
      }}
    >
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h1
        style={{
          ...display,
          fontSize: "clamp(36px, 5.5vw, 60px)",
          fontWeight: 600,
          lineHeight: 1.05,
          letterSpacing: "-0.03em",
          margin: 0,
          color: tone.fg,
        }}
      >
        {title}
      </h1>
      {blurb && (
        <p
          style={{
            fontSize: 18,
            lineHeight: 1.6,
            color: tone.muted,
            margin: 0,
            maxWidth: 640,
          }}
        >
          {blurb}
        </p>
      )}
    </header>
  );
}

// ─── Section head (used mid-page) ──────────────────────────────────────
export function SectionHead({
  eyebrow,
  title,
  blurb,
  align = "center",
}: {
  eyebrow?: string;
  title: ReactNode;
  blurb?: ReactNode;
  align?: "center" | "left";
}) {
  return (
    <div
      style={{
        textAlign: align,
        maxWidth: align === "center" ? 720 : "none",
        margin: align === "center" ? "0 auto 56px" : "0 0 56px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        alignItems: align === "center" ? "center" : "flex-start",
      }}
    >
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2
        style={{
          ...display,
          fontSize: "clamp(28px, 4vw, 44px)",
          fontWeight: 600,
          lineHeight: 1.1,
          margin: 0,
          color: tone.fg,
        }}
      >
        {title}
      </h2>
      {blurb && (
        <p
          style={{
            fontSize: 17,
            lineHeight: 1.6,
            color: tone.muted,
            margin: 0,
            maxWidth: 600,
          }}
        >
          {blurb}
        </p>
      )}
    </div>
  );
}

// ─── Card ──────────────────────────────────────────────────────────────
export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        background: tone.card,
        border: `1px solid ${tone.border}`,
        borderRadius: 16,
        padding: 28,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── Icon badge ───────────────────────────────────────────────────────
export function IconBadge({
  children,
  tint,
}: {
  children: ReactNode;
  tint?: string;
}) {
  const color = tint || BRAND;
  return (
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: 12,
        background: `${color}1A`,
        color,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
      }}
    >
      {children}
    </div>
  );
}

// ─── Auto-flow grid (CSS-only responsive, no breakpoints) ──────────────
export function Grid({
  children,
  min = 280,
  gap = 20,
  style,
}: {
  children: ReactNode;
  min?: number;
  gap?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`,
        gap,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── Dark CTA panel ────────────────────────────────────────────────────
export function CtaPanel({
  title,
  blurb,
  children,
}: {
  title: ReactNode;
  blurb?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        background: "#020617",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 24,
        padding: "64px 32px",
        textAlign: "center",
        boxShadow: "0 40px 80px -40px rgba(15,23,42,0.4)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -96,
          left: -96,
          width: 320,
          height: 320,
          background: `${BRAND}33`,
          borderRadius: 999,
          filter: "blur(80px)",
          opacity: 0.6,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -96,
          right: -96,
          width: 320,
          height: 320,
          background: `${BRAND_ACCENT}33`,
          borderRadius: 999,
          filter: "blur(80px)",
          opacity: 0.6,
        }}
      />
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: 20,
          alignItems: "center",
        }}
      >
        <h2
          style={{
            ...display,
            fontSize: "clamp(28px, 4vw, 44px)",
            fontWeight: 600,
            lineHeight: 1.1,
            margin: 0,
            color: "white",
          }}
        >
          {title}
        </h2>
        {blurb && (
          <p
            style={{
              fontSize: 17,
              lineHeight: 1.6,
              color: "#94a3b8",
              maxWidth: 560,
              margin: 0,
            }}
          >
            {blurb}
          </p>
        )}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            justifyContent: "center",
            marginTop: 12,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
