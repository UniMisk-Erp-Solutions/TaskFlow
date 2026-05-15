import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Menu, X, Sun, Moon, Layout, ArrowRight, ChevronDown } from "lucide-react";
import { useTheme } from "@/src/lib/ThemeContext";
import { Button } from "../ui/Button";
import { tone, display, BRAND } from "../../lib/ui";

declare const __TASKFLOW_BUILD__: string;
const BUILD_STAMP = typeof __TASKFLOW_BUILD__ === "string" ? __TASKFLOW_BUILD__ : "dev";

const NAV_HEIGHT = 64;

const primaryLinks = [
  { name: "Product", href: "/" },
  { name: "Features", href: "/features" },
  { name: "Pricing", href: "/pricing" },
];

const resourceLinks = [
  { name: "Security", href: "/security" },
  { name: "Docs", href: "/docs" },
  { name: "Privacy", href: "/privacy" },
  { name: "Terms", href: "/terms" },
];

const otherLinks = [
  { name: "About", href: "/about" },
  { name: "Contact", href: "/contact" },
];

/**
 * Marketing navbar — three rigid zones (logo / centered nav / right cluster).
 * Layout is encoded in inline styles so cache/build issues can't break it.
 *
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │ [logo]   ◄────── primary nav (centered) ──────►   [theme] [auth] │
 *   └──────────────────────────────────────────────────────────────────┘
 *
 * The center group is absolute-centered against the navbar so it stays
 * perfectly aligned regardless of the side widths.
 */
export const Navbar = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isResourcesOpen, setIsResourcesOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const linkBase = (active: boolean): React.CSSProperties => ({
    fontSize: 13,
    fontWeight: 500,
    letterSpacing: "-0.005em",
    color: active ? tone.fg : tone.muted,
    textDecoration: "none",
    padding: "8px 4px",
    transition: "color 150ms",
    whiteSpace: "nowrap",
  });

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        height: NAV_HEIGHT,
        background: scrolled ? `color-mix(in srgb, ${tone.bg} 88%, transparent)` : `color-mix(in srgb, ${tone.bg} 70%, transparent)`,
        backdropFilter: "saturate(180%) blur(12px)",
        WebkitBackdropFilter: "saturate(180%) blur(12px)",
        borderBottom: scrolled ? `1px solid ${tone.border}` : "1px solid transparent",
        transition: "background 200ms, border-color 200ms",
      }}
    >
      <div
        style={{
          position: "relative",
          maxWidth: 1280,
          height: "100%",
          margin: "0 auto",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        {/* LOGO */}
        <Link
          to="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            textDecoration: "none",
            color: tone.fg,
            flexShrink: 0,
            zIndex: 2,
          }}
        >
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
              transition: "transform 200ms",
            }}
          >
            <Layout size={17} strokeWidth={2.2} />
          </div>
          <span
            style={{
              ...display,
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: "-0.015em",
              color: tone.fg,
            }}
          >
            Taskflow
          </span>
          <span
            title={`build ${BUILD_STAMP}`}
            style={{
              fontSize: 10,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              color: tone.muted,
              padding: "2px 6px",
              borderRadius: 5,
              border: `1px solid ${tone.border}`,
              background: tone.card,
              letterSpacing: "0.02em",
            }}
          >
            {BUILD_STAMP.slice(2, 10)}
          </span>
        </Link>

        {/* CENTER NAV (desktop, absolute-centered) */}
        <div
          className="tf-marketing-nav-center"
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            display: "none", // toggled to flex on desktop via media query class below
            alignItems: "center",
            gap: 28,
            zIndex: 1,
          }}
        >
          {primaryLinks.map((link) => (
            <Link
              key={link.name}
              to={link.href}
              style={linkBase(location.pathname === link.href)}
            >
              {link.name}
            </Link>
          ))}

          {/* Resources dropdown */}
          <div
            style={{ position: "relative" }}
            onMouseEnter={() => setIsResourcesOpen(true)}
            onMouseLeave={() => setIsResourcesOpen(false)}
          >
            <button
              type="button"
              style={{
                ...linkBase(resourceLinks.some((l) => location.pathname === l.href)),
                background: "none",
                border: "none",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontFamily: "inherit",
              }}
            >
              Resources
              <ChevronDown
                size={12}
                style={{
                  transition: "transform 150ms",
                  transform: isResourcesOpen ? "rotate(180deg)" : "rotate(0)",
                }}
              />
            </button>

            <AnimatePresence>
              {isResourcesOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.15 }}
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: "50%",
                    transform: "translateX(-50%)",
                    paddingTop: 12,
                    width: 192,
                  }}
                >
                  <div
                    style={{
                      background: tone.card,
                      border: `1px solid ${tone.border}`,
                      borderRadius: 12,
                      padding: 6,
                      boxShadow: "0 24px 48px -24px rgba(15,23,42,0.18)",
                    }}
                  >
                    {resourceLinks.map((link) => {
                      const active = location.pathname === link.href;
                      return (
                        <Link
                          key={link.name}
                          to={link.href}
                          style={{
                            display: "block",
                            padding: "8px 12px",
                            borderRadius: 8,
                            fontSize: 13,
                            fontWeight: 500,
                            textDecoration: "none",
                            color: active ? BRAND : tone.muted,
                            background: active ? `${BRAND}14` : "transparent",
                          }}
                        >
                          {link.name}
                        </Link>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {otherLinks.map((link) => (
            <Link
              key={link.name}
              to={link.href}
              style={linkBase(location.pathname === link.href)}
            >
              {link.name}
            </Link>
          ))}
        </div>

        {/* RIGHT CLUSTER */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
            zIndex: 2,
          }}
        >
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              border: "none",
              background: "transparent",
              color: tone.muted,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 120ms, color 120ms",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = tone.accent;
              e.currentTarget.style.color = tone.fg;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = tone.muted;
            }}
          >
            {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
          </button>

          {/* Desktop-only login/CTA */}
          <div
            className="tf-marketing-nav-auth"
            style={{
              display: "none",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Link
              to="/login"
              style={{
                fontSize: 13,
                fontWeight: 500,
                letterSpacing: "-0.005em",
                color: tone.muted,
                textDecoration: "none",
                padding: "8px 12px",
                borderRadius: 8,
                transition: "color 150ms",
              }}
            >
              Login
            </Link>
            <Button size="sm" to="/login?mode=signup" className="px-7 min-w-[120px]">Start free</Button>
          </div>

          {/* Mobile burger */}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
            className="tf-marketing-nav-burger"
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              border: "none",
              background: "transparent",
              color: tone.fg,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile sheet */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            style={{
              position: "fixed",
              top: NAV_HEIGHT,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 40,
              background: tone.bg,
              overflowY: "auto",
              padding: "32px 32px 48px",
              display: "flex",
              flexDirection: "column",
              gap: 24,
            }}
          >
            {[...primaryLinks, ...resourceLinks, ...otherLinks].map((link) => {
              const active = location.pathname === link.href;
              return (
                <Link
                  key={link.name}
                  to={link.href}
                  onClick={() => setIsOpen(false)}
                  style={{
                    ...display,
                    fontSize: 24,
                    fontWeight: 600,
                    color: active ? BRAND : tone.fg,
                    textDecoration: "none",
                  }}
                >
                  {link.name}
                </Link>
              );
            })}
            <div
              style={{
                marginTop: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <Link
                to="/login"
                onClick={() => setIsOpen(false)}
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  padding: "14px 18px",
                  background: tone.accent,
                  borderRadius: 12,
                  textAlign: "center",
                  textDecoration: "none",
                  color: tone.fg,
                }}
              >
                Login
              </Link>
              <Button size="lg" to="/login?mode=signup" onClick={() => setIsOpen(false)} className="w-full">
                Get started <ArrowRight style={{ marginLeft: 8, width: 16, height: 16 }} />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tiny inline media-query so center nav + auth cluster appear above 1024px
         without dragging in another stylesheet. The classes flip display:flex. */}
      <style>{`
        @media (min-width: 1024px) {
          .tf-marketing-nav-center { display: flex !important; }
          .tf-marketing-nav-auth { display: inline-flex !important; }
          .tf-marketing-nav-burger { display: none !important; }
        }
      `}</style>
    </nav>
  );
};
