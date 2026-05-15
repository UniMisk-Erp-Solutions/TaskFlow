import { Link } from "react-router-dom";
import { Layout, Github, Twitter, Linkedin, Mail } from "lucide-react";

export const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[var(--card)] border-t border-[var(--border)] pt-20 pb-10 px-6">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
        <div className="space-y-5">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="size-8 bg-brand-primary rounded-lg flex items-center justify-center text-white shadow-[0_4px_12px_-4px_rgba(139,92,246,0.5)]">
              <Layout size={18} strokeWidth={2.2} />
            </div>
            <span className="text-lg font-semibold tracking-tight font-display">Taskflow</span>
          </Link>
          <p className="text-[var(--muted)] text-sm leading-relaxed max-w-xs">
            The execution workspace for teams that plan, track, and deliver work with total clarity.
          </p>
          <div className="flex gap-4">
            <a href="#" className="p-2 rounded-lg bg-[var(--accent)] text-[var(--muted)] hover:text-brand-primary transition-colors">
              <Twitter size={20} />
            </a>
            <a href="#" className="p-2 rounded-lg bg-[var(--accent)] text-[var(--muted)] hover:text-brand-primary transition-colors">
              <Linkedin size={20} />
            </a>
            <a href="#" className="p-2 rounded-lg bg-[var(--accent)] text-[var(--muted)] hover:text-brand-primary transition-colors">
              <Github size={20} />
            </a>
          </div>
        </div>

        <div>
          <h4 className="font-semibold mb-5 text-sm tracking-tight text-[var(--foreground)]">Product</h4>
          <ul className="space-y-3 text-sm text-[var(--muted)]">
            <li><Link to="/features" className="hover:text-brand-primary transition-colors">Features</Link></li>
            <li><Link to="/pricing" className="hover:text-brand-primary transition-colors">Pricing</Link></li>
            <li><Link to="#" className="hover:text-brand-primary transition-colors">Integrations</Link></li>
            <li><Link to="#" className="hover:text-brand-primary transition-colors">Changelog</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold mb-5 text-sm tracking-tight text-[var(--foreground)]">Company</h4>
          <ul className="space-y-3 text-sm text-[var(--muted)]">
            <li><Link to="/about" className="hover:text-brand-primary transition-colors">About Us</Link></li>
            <li><Link to="/contact" className="hover:text-brand-primary transition-colors">Contact</Link></li>
            <li><Link to="/security" className="hover:text-brand-primary transition-colors">Security</Link></li>
            <li><Link to="/privacy" className="hover:text-brand-primary transition-colors">Privacy Policy</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold mb-5 text-sm tracking-tight text-[var(--foreground)]">Resources</h4>
          <ul className="space-y-3 text-sm text-[var(--muted)]">
            <li><Link to="/docs" className="hover:text-brand-primary transition-colors">Documentation</Link></li>
            <li><Link to="/docs" className="hover:text-brand-primary transition-colors">Help Center</Link></li>
            <li><Link to="/security" className="hover:text-brand-primary transition-colors">Security</Link></li>
            <li><Link to="/terms" className="hover:text-brand-primary transition-colors">Terms & Conditions</Link></li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto pt-8 border-t border-[var(--border)] flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[var(--muted)]">
        <p>© {currentYear} Taskflow. All rights reserved.</p>
        <div className="flex gap-6">
          <Link to="/terms" className="hover:text-[var(--foreground)] transition-colors">Terms of Service</Link>
          <Link to="/privacy" className="hover:text-[var(--foreground)] transition-colors">Privacy Policy</Link>
          <Link to="/docs" className="hover:text-[var(--foreground)] transition-colors">Docs</Link>
        </div>
      </div>
    </footer>
  );
};
