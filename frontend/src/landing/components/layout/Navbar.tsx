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
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  const navLinks = [
    { name: "Product", href: "/" },
    { name: "Features", href: "/features" },
    { name: "Pricing", href: "/pricing" },
  ];

  const resourceLinks = [
    { name: "Security", href: "/security" },
    { name: "Privacy Policy", href: "/privacy" },
    { name: "Terms & Conditions", href: "/terms" },
    { name: "Docs", href: "/docs" },
  ];

  const otherLinks = [
    { name: "About", href: "/about" },
    { name: "Contact", href: "/contact" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[var(--background)]/75 backdrop-blur-xl border-b border-[var(--border)] h-16 flex items-center transition-all duration-300">
      <div className="max-w-7xl mx-auto w-full px-6 flex items-center justify-between relative">
        <Link to="/" className="flex items-center gap-2.5 group shrink-0 relative z-50">
          <div className="size-8 bg-brand-primary rounded-lg flex items-center justify-center text-white shadow-[0_4px_12px_-4px_rgba(139,92,246,0.5)] group-hover:rotate-3 transition-transform">
            <Layout size={18} strokeWidth={2.2} />
          </div>
          <span className="text-lg font-semibold tracking-tight font-display">Taskflow</span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden lg:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              to={link.href}
              className={cn(
                "text-sm font-medium transition-colors hover:text-brand-primary",
                location.pathname === link.href ? "text-brand-primary" : "text-[var(--muted)]"
              )}
            >
              {link.name}
            </Link>
          ))}

          {/* Dropdown */}
          <div 
            className="relative"
            onMouseEnter={() => setIsResourcesOpen(true)}
            onMouseLeave={() => setIsResourcesOpen(false)}
          >
            <button className={cn(
              "flex items-center gap-1 text-sm font-medium transition-colors hover:text-brand-primary",
              resourceLinks.some(l => location.pathname === l.href) ? "text-brand-primary" : "text-[var(--muted)]"
            )}>
              Resources <ChevronDown size={14} className={cn("transition-transform", isResourcesOpen && "rotate-180")} />
            </button>
            
            <AnimatePresence>
              {isResourcesOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-full left-1/2 -translate-x-1/2 pt-4 w-56"
                >
                  <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-2 shadow-2xl">
                    {resourceLinks.map((link) => (
                      <Link
                        key={link.name}
                        to={link.href}
                        className={cn(
                          "block px-4 py-3 rounded-xl text-sm font-medium transition-colors hover:bg-[var(--accent)]",
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
                "text-sm font-medium transition-colors hover:text-brand-primary",
                location.pathname === link.href ? "text-brand-primary" : "text-[var(--muted)]"
              )}
            >
              {link.name}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl hover:bg-[var(--accent)] transition-colors text-[var(--muted)]"
            aria-label="Toggle theme"
          >
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          
          <div className="hidden lg:flex items-center gap-4 ml-2">
            <Link to="/login" className="text-sm font-medium hover:text-brand-primary">Login</Link>
            <Button size="sm" to="/login?mode=signup">Start Free</Button>
          </div>

          <button
            onClick={() => setIsOpen(!isOpen)}
            className="lg:hidden p-2 rounded-xl hover:bg-[var(--accent)] transition-colors text-[var(--foreground)] relative z-50"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="lg:hidden absolute top-0 left-0 right-0 h-screen bg-[var(--background)] z-40 flex flex-col p-8 pt-28 gap-8"
          >
            {[...navLinks, ...resourceLinks, ...otherLinks].map((link) => (
              <Link
                key={link.name}
                to={link.href}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "text-2xl font-semibold tracking-tight font-display",
                  location.pathname === link.href ? "text-brand-primary" : "text-[var(--foreground)]"
                )}
              >
                {link.name}
              </Link>
            ))}
            <div className="mt-auto flex flex-col gap-4 pb-12">
              <Link to="/login" onClick={() => setIsOpen(false)} className="text-base font-semibold p-3.5 bg-[var(--accent)] rounded-xl text-center tracking-tight">Login</Link>
              <Button size="lg" to="/login?mode=signup" onClick={() => setIsOpen(false)} className="w-full">Get Started <ArrowRight className="ml-2 size-5" /></Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};
