import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Menu, X, Sun, Moon, Layout, ArrowRight, ChevronDown } from "lucide-react";
import { useTheme } from "@/src/lib/ThemeContext";
import { Button } from "../ui/Button";
import { cn } from "@/src/lib/utils";

declare const __TASKFLOW_BUILD__: string;
const BUILD_STAMP = typeof __TASKFLOW_BUILD__ === "string" ? __TASKFLOW_BUILD__ : "dev";

/**
 * Marketing Navbar — always has a solid background (no transparent state),
 * always position: fixed so `pt-*` on each page reserves enough room. Inline
 * positioning styles guard against the case where a Tailwind utility might
 * not compile through.
 */
export const Navbar = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isResourcesOpen, setIsResourcesOpen] = React.useState(false);
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

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

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        height: 64,
      }}
      className="bg-[var(--background)]/90 backdrop-blur-xl border-b border-[var(--border)]"
    >
      <div
        className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between"
      >
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group flex-shrink-0">
          <div
            className="bg-brand-primary rounded-lg flex items-center justify-center text-white"
            style={{ width: 32, height: 32, boxShadow: "0 4px 12px -4px rgba(139,92,246,0.5)" }}
          >
            <Layout size={17} strokeWidth={2.2} />
          </div>
          <span className="text-[15px] font-semibold tracking-tight font-display">Taskflow</span>
          <span
            className="hidden sm:inline-block text-[10px] font-mono text-[var(--muted)] px-1.5 py-0.5 rounded border border-[var(--border)] bg-[var(--card)]"
            title={`build ${BUILD_STAMP}`}
          >
            {BUILD_STAMP.slice(2, 10)}
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden lg:flex items-center gap-7">
          {primaryLinks.map((link) => (
            <Link
              key={link.name}
              to={link.href}
              className={cn(
                "text-[13px] font-medium tracking-tight transition-colors hover:text-[var(--foreground)]",
                location.pathname === link.href ? "text-[var(--foreground)]" : "text-[var(--muted)]"
              )}
            >
              {link.name}
            </Link>
          ))}

          <div
            className="relative"
            onMouseEnter={() => setIsResourcesOpen(true)}
            onMouseLeave={() => setIsResourcesOpen(false)}
          >
            <button
              type="button"
              className={cn(
                "flex items-center gap-1 text-[13px] font-medium tracking-tight transition-colors hover:text-[var(--foreground)]",
                resourceLinks.some((l) => location.pathname === l.href) ? "text-[var(--foreground)]" : "text-[var(--muted)]"
              )}
            >
              Resources <ChevronDown size={12} className={cn("transition-transform", isResourcesOpen && "rotate-180")} />
            </button>

            <AnimatePresence>
              {isResourcesOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-1/2 pt-3"
                  style={{ transform: "translateX(-50%)", width: 192 }}
                >
                  <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-1.5 shadow-xl">
                    {resourceLinks.map((link) => (
                      <Link
                        key={link.name}
                        to={link.href}
                        className={cn(
                          "block px-3 py-2 rounded-lg text-[13px] font-medium tracking-tight transition-colors hover:bg-[var(--accent)]",
                          location.pathname === link.href ? "text-brand-primary bg-[var(--accent)]" : "text-[var(--muted)]"
                        )}
                      >
                        {link.name}
                      </Link>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {otherLinks.map((link) => (
            <Link
              key={link.name}
              to={link.href}
              className={cn(
                "text-[13px] font-medium tracking-tight transition-colors hover:text-[var(--foreground)]",
                location.pathname === link.href ? "text-[var(--foreground)]" : "text-[var(--muted)]"
              )}
            >
              {link.name}
            </Link>
          ))}
        </div>

        {/* Right cluster */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-[var(--accent)] transition-colors text-[var(--muted)] hover:text-[var(--foreground)]"
            aria-label="Toggle theme"
          >
            {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
          </button>

          <div className="hidden lg:flex items-center gap-2">
            <Link
              to="/login"
              className="text-[13px] font-medium tracking-tight text-[var(--muted)] hover:text-[var(--foreground)] transition-colors px-3 py-2"
            >
              Login
            </Link>
            <Button size="sm" to="/login?mode=signup">Start free</Button>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="lg:hidden p-2 rounded-lg hover:bg-[var(--accent)] transition-colors text-[var(--foreground)]"
            aria-label="Toggle menu"
          >
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile sheet */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden bg-[var(--background)] flex flex-col p-8 gap-6"
            style={{
              position: "fixed",
              top: 64,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 40,
              overflowY: "auto",
            }}
          >
            {[...primaryLinks, ...resourceLinks, ...otherLinks].map((link) => (
              <Link
                key={link.name}
                to={link.href}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "font-display text-2xl font-semibold tracking-tight",
                  location.pathname === link.href ? "text-brand-primary" : "text-[var(--foreground)]"
                )}
              >
                {link.name}
              </Link>
            ))}
            <div className="mt-auto flex flex-col gap-3 pb-12">
              <Link
                to="/login"
                onClick={() => setIsOpen(false)}
                className="text-base font-semibold p-3.5 bg-[var(--accent)] rounded-xl text-center tracking-tight"
              >
                Login
              </Link>
              <Button size="lg" to="/login?mode=signup" onClick={() => setIsOpen(false)} className="w-full">
                Get started <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};
