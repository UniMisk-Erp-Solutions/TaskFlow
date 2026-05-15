import { Link } from "react-router-dom";
import { Layout, Github, Twitter, Linkedin } from "lucide-react";

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

export const Footer = () => {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--card)]">
      <div className="max-w-7xl mx-auto px-6 pt-20 pb-10">
        {/* Top grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-16">
          {/* Brand block */}
          <div className="md:col-span-5 lg:col-span-4 space-y-5">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="size-8 bg-brand-primary rounded-lg flex items-center justify-center text-white shadow-[0_4px_12px_-4px_rgba(139,92,246,0.5)]">
                <Layout size={17} strokeWidth={2.2} />
              </div>
              <span className="text-[15px] font-semibold tracking-tight font-display">Taskflow</span>
            </Link>
            <p className="text-sm text-[var(--muted)] leading-relaxed max-w-xs">
              The execution workspace for teams that plan, track, and deliver
              with total clarity.
            </p>
            <div className="flex gap-2">
              {[
                { i: <Twitter size={16} />, l: "Twitter" },
                { i: <Linkedin size={16} />, l: "LinkedIn" },
                { i: <Github size={16} />, l: "GitHub" },
              ].map((s) => (
                <a
                  key={s.l}
                  href="#"
                  aria-label={s.l}
                  className="size-9 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--muted)] hover:text-brand-primary hover:border-brand-primary/30 transition-colors flex items-center justify-center"
                >
                  {s.i}
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          <div className="md:col-span-7 lg:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-8">
            {columns.map((col) => (
              <div key={col.title}>
                <h4 className="text-xs font-semibold tracking-[0.12em] uppercase text-[var(--foreground)] mb-5">
                  {col.title}
                </h4>
                <ul className="space-y-3 text-sm">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link
                        to={l.to}
                        className="text-[var(--muted)] hover:text-brand-primary transition-colors"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom strip */}
        <div className="pt-8 border-t border-[var(--border)] flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[var(--muted)]">
          <p>© {year} Taskflow. All rights reserved.</p>
          <div className="flex items-center gap-5">
            <Link to="/terms" className="hover:text-[var(--foreground)] transition-colors">Terms</Link>
            <span className="size-1 rounded-full bg-[var(--border)]" />
            <Link to="/privacy" className="hover:text-[var(--foreground)] transition-colors">Privacy</Link>
            <span className="size-1 rounded-full bg-[var(--border)]" />
            <Link to="/security" className="hover:text-[var(--foreground)] transition-colors">Security</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
