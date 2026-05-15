import { Link } from "react-router-dom";
import { Layout, Github, Twitter, Linkedin } from "lucide-react";
import { tone, display, BRAND } from "../../lib/ui";

const columns = [
  {
    title: "Product",
    links: [
      { to: "/features", label: "Features" },
      { to: "/pricing", label: "Pricing" },
      { to: "/security", label: "Security" },
      { to: "/docs", label: "Changelog" },
    ],
  },
  {
    title: "Company",
    links: [
      { to: "/about", label: "About" },
      { to: "/contact", label: "Contact" },
      { to: "/about", label: "Careers" },
      { to: "/contact", label: "Press" },
    ],
  },
  {
    title: "Resources",
    links: [
      { to: "/docs", label: "Documentation" },
      { to: "/docs", label: "Help center" },
      { to: "/privacy", label: "Privacy" },
      { to: "/terms", label: "Terms" },
    ],
  },
];

const socials = [
  { i: <Twitter size={16} />, l: "Twitter" },
  { i: <Linkedin size={16} />, l: "LinkedIn" },
  { i: <Github size={16} />, l: "GitHub" },
];

export const Footer = () => {
  const year = new Date().getFullYear();
  return (
    <footer
      style={{
        borderTop: `1px solid ${tone.border}`,
        background: tone.card,
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "72px 24px 36px",
        }}
      >
        {/* Top grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 48,
            marginBottom: 56,
          }}
        >
          {/* Brand block */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 280 }}>
            <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none", color: tone.fg }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  background: BRAND,
                  borderRadius: 8,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  boxShadow: `0 4px 12px -4px ${BRAND}80`,
                }}
              >
                <Layout size={17} strokeWidth={2.2} />
              </div>
              <span style={{ ...display, fontSize: 15, fontWeight: 600, color: tone.fg }}>Taskflow</span>
            </Link>
            <p style={{ fontSize: 14, color: tone.muted, lineHeight: 1.6, margin: 0 }}>
              The execution workspace for teams that plan, track, and deliver with total clarity.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              {socials.map((s) => (
                <a
                  key={s.l}
                  href="#"
                  aria-label={s.l}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    border: `1px solid ${tone.border}`,
                    background: tone.bg,
                    color: tone.muted,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textDecoration: "none",
                    transition: "all 150ms",
                  }}
                >
                  {s.i}
                </a>
              ))}
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h4
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: tone.fg,
                  margin: "0 0 20px",
                }}
              >
                {col.title}
              </h4>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      to={l.to}
                      style={{ fontSize: 14, color: tone.muted, textDecoration: "none" }}
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom strip */}
        <div
          style={{
            paddingTop: 28,
            borderTop: `1px solid ${tone.border}`,
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            fontSize: 12,
            color: tone.muted,
          }}
        >
          <p style={{ margin: 0 }}>© {year} Taskflow. All rights reserved.</p>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Link to="/terms" style={{ color: tone.muted, textDecoration: "none" }}>Terms</Link>
            <span style={{ width: 3, height: 3, borderRadius: 999, background: tone.border }} />
            <Link to="/privacy" style={{ color: tone.muted, textDecoration: "none" }}>Privacy</Link>
            <span style={{ width: 3, height: 3, borderRadius: 999, background: tone.border }} />
            <Link to="/security" style={{ color: tone.muted, textDecoration: "none" }}>Security</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
