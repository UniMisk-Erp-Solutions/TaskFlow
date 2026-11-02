import * as React from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { Menu, X, ArrowRight, ChevronDown } from "lucide-react";
import { Button } from "../ui/Button";
import { tone, display, BRAND } from "../../lib/ui";
import { HOME_DARK_VARS } from "../../lib/homeDark";

const NAV_HEIGHT = 64;

// Where the pointer was when a Resources link was clicked. The page then changes under a motionless pointer and the
// browser sends a synthetic "mouse entered" event with the same coordinates, which would pop the menu back open. Events
// at exactly that spot are ignored; the menu opens again as soon as the pointer really moves.
let menuClosedAt: { x: number; y: number } | null = null;

const primaryLinks = [
  { name: "Product", href: "/" },
  { name: "Features", href: "/features" },
  { name: "Pricing", href: "/pricing" },
];

const resourceLinks = [
  { name: "Security", href: "/security" },
  { name: "Docs", href: "/docs" },
  { name: "Blog", href: "/blog" },
  { name: "Privacy", href: "/privacy" },
  { name: "Terms", href: "/terms" },
];

const otherLinks = [
  { name: "FAQ", href: "/faq" },
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
  const closeMenu = (e: React.MouseEvent) => { menuClosedAt = { x: e.clientX, y: e.clientY }; setIsResourcesOpen(false); };
  const [scrolled, setScrolled] = React.useState(false);
  const location = useLocation();

  // Close the Resources menu as soon as a page is chosen (and whenever the page changes).
  React.useEffect(() => { setIsResourcesOpen(false); }, [location.pathname]);

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
        ...HOME_DARK_VARS,
        position: "fixed",
        top: 14,
        left: 0,
        right: 0,
        zIndex: 50,
        height: NAV_HEIGHT,
        // The bar floats as a rounded glass pill over the page instead of spanning the full width.
        width: "calc(100% - 32px)",
        maxWidth: 1120,
        margin: "0 auto",
        borderRadius: 999,
        background: scrolled ? "var(--nav-bg-solid)" : "var(--nav-bg)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        border: "1px solid var(--glass-edge)",
        transition: "background 200ms",
        boxShadow: "0 12px 40px -16px rgba(0, 0, 0, 0.6)",
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
          <img
            src="/logo-mark.png"
            alt=""
            width={34}
            height={34}
            style={{ width: 34, height: 34, borderRadius: 9, display: "block", boxShadow: "0 4px 14px -6px rgba(255, 255, 255, 0.35)" }}
          />
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
            onMouseEnter={(e) => {
              if (menuClosedAt && e.clientX === menuClosedAt.x && e.clientY === menuClosedAt.y) return;
              menuClosedAt = null;
              setIsResourcesOpen(true);
            }}
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

              {isResourcesOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
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
                      background: "rgba(4, 6, 16, 0.96)",
                      border: "1px solid rgba(255, 255, 255, 0.10)",
                      borderRadius: 12,
                      padding: 6,
                      boxShadow: "0 24px 60px -20px rgba(0, 0, 0, 0.85)",
                    }}
                  >
                    {resourceLinks.map((link) => {
                      const active = location.pathname === link.href;
                      return (
                        <Link
                          key={link.name}
                          to={link.href}
                          onClick={closeMenu}
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
          {/* Sign in / Sign up */}
          <div
            className="tf-marketing-nav-auth"
            style={{
              display: "inline-flex",
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
              Sign in
            </Link>
            <Button size="sm" to="/login?mode=signup" style={{ paddingLeft: 18, paddingRight: 18 }}>Sign up</Button>
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

      {/* Mobile menu. It is drawn into <body> because this bar uses backdrop-filter, which would otherwise make a
          fixed child size itself against the 64px bar instead of the screen. */}
      {isOpen && createPortal(
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            style={{
              ...HOME_DARK_VARS,
              position: "fixed",
              top: 14 + NAV_HEIGHT + 10,
              left: 16,
              right: 16,
              bottom: 16,
              zIndex: 49,
              background: "rgba(4, 6, 16, 0.95)",
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: 24,
              boxShadow: "0 30px 80px -20px rgba(0, 0, 0, 0.8)",
              color: "var(--foreground)",
              overflowY: "auto",
              padding: "28px 28px 32px",
              display: "flex",
              flexDirection: "column",
              gap: 20,
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
                    fontSize: 22,
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
                Sign in
              </Link>
              <Button size="lg" to="/login?mode=signup" onClick={() => setIsOpen(false)} className="w-full">
                Sign up <ArrowRight style={{ marginLeft: 8, width: 16, height: 16 }} />
              </Button>
            </div>
          </motion.div>,
        document.body,
      )}

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
