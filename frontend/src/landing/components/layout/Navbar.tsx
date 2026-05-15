import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Menu, X, Sun, Moon, Layout, ArrowRight, ChevronDown } from "lucide-react";
import { useTheme } from "@/src/lib/ThemeContext";
import { Button } from "../ui/Button";
import { cn } from "@/src/lib/utils";

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
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-[var(--background)]/85 backdrop-blur-xl border-b border-[var(--border)]"
          : "bg-transparent border-b border-transparent",
      )}
    >
      <div className="max-w-7xl mx-auto w-full px-6 h-16 flex items-center justify-between relative">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group shrink-0 relative z-50">
          <div className="size-8 bg-brand-primary rounded-lg flex items-center justify-center text-white shadow-[0_4px_12px_-4px_rgba(139,92,246,0.5)] group-hover:rotate-3 transition-transform">
            <Layout size={17} strokeWidth={2.2} />
          </div>
          <span className="text-[15px] font-semibold tracking-tight font-display">Taskflow</span>
        </Link>

        {/* Desktop */}
        <div className="hidden lg:flex items-center gap-7 absolute left-1/2 -translate-x-1/2">
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
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-1/2 -translate-x-1/2 pt-3 w-48"
                >
                  <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-1.5 shadow-[0_20px_40px_-16px_rgba(15,23,42,0.18)]">
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
        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-[var(--accent)] transition-colors text-[var(--muted)] hover:text-[var(--foreground)]"
            aria-label="Toggle theme"
          >
            {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
          </button>

          <div className="hidden lg:flex items-center gap-2 ml-2">
            <Link to="/login" className="text-[13px] font-medium tracking-tight text-[var(--muted)] hover:text-[var(--foreground)] transition-colors px-3 py-2">
              Login
            </Link>
            <Button size="sm" to="/login?mode=signup">Start free</Button>
          </div>

          <button
            onClick={() => setIsOpen(!isOpen)}
            className="lg:hidden p-2 rounded-lg hover:bg-[var(--accent)] transition-colors text-[var(--foreground)] relative z-50"
            aria-label="Toggle menu"
          >
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden absolute top-0 left-0 right-0 h-screen bg-[var(--background)] z-40 flex flex-col p-8 pt-24 gap-6"
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
              <Link to="/login" onClick={() => setIsOpen(false)} className="text-sm font-semibold p-3 bg-[var(--accent)] rounded-xl text-center tracking-tight">
                Login
              </Link>
              <Button size="lg" to="/login?mode=signup" onClick={() => setIsOpen(false)} className="w-full">
                Get started <ArrowRight className="ml-2 size-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};
