import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, CheckSquare, Bell, Users, ArrowRight } from 'lucide-react';

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'About',    href: '#about'    },
];

const FEATURES = [
  {
    icon: Zap,
    title: 'AI Assistant',
    desc: 'Ask anything about your team\'s workload in plain English. Instant, accurate answers pulled directly from live task data.',
  },
  {
    icon: Bell,
    title: 'Smart Reminders',
    desc: 'AI-written follow-up emails sent automatically before deadlines. Keeps every employee accountable without manual effort.',
  },
  {
    icon: Users,
    title: 'Role-Based Access',
    desc: 'Admins assign and oversee. Employees focus and execute. Clean separation of responsibilities built into every view.',
  },
  {
    icon: CheckSquare,
    title: 'Real-Time Tracking',
    desc: 'Status updates appear instantly across all sessions via Supabase Realtime. No refresh needed, no lag.',
  },
];

const S = {
  page: { background: 'var(--color-canvas-parchment)', minHeight: '100vh', color: 'var(--tf-text)', fontFamily: 'var(--font-ui)' },

  header: (scrolled) => ({
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    height: 44,
    display: 'flex',
    alignItems: 'center',
    padding: '0 22px',
    justifyContent: 'space-between',
    background: scrolled ? 'var(--tf-nav)' : 'var(--tf-nav)',
    borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
    transition: 'border-color 200ms ease',
  }),
  logo: { display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' },
  logoText: { fontSize: 17, fontWeight: 600, color: 'var(--color-body-on-dark)', letterSpacing: '-0.022em', fontFamily: 'var(--font-display)' },
  nav: { display: 'flex', alignItems: 'center', gap: 24 },
  navLink: { fontSize: 12, fontWeight: 400, letterSpacing: '-0.01em', color: 'rgba(255,255,255,0.65)', textDecoration: 'none', transition: 'color 120ms ease' },
  headerActions: { display: 'flex', alignItems: 'center', gap: 10 },

  hero: {
    minHeight: '88vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '96px 24px 72px',
    paddingTop: 120,
    background: 'var(--color-canvas)',
  },
  heroTag: {
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.14em',
    color: 'var(--tf-muted)',
    textTransform: 'uppercase',
    marginBottom: 20,
  },
  heroH1: {
    fontSize: 'clamp(36px, 5.5vw, 56px)',
    fontFamily: 'var(--font-display)',
    fontWeight: 600,
    letterSpacing: '-0.028px',
    lineHeight: 1.07,
    maxWidth: 720,
    marginBottom: 20,
    color: 'var(--tf-text)',
  },
  heroSub: {
    fontSize: 19,
    fontWeight: 300,
    color: 'var(--tf-muted)',
    maxWidth: 460,
    lineHeight: 1.5,
    marginBottom: 36,
  },
  heroActions: { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' },

  section: { maxWidth: 1060, margin: '0 auto', padding: '72px 32px' },
  sectionLabel: {
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.08em',
    color: 'var(--color-primary-on-dark)',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 'clamp(28px, 3.2vw, 40px)',
    fontFamily: 'var(--font-display)',
    fontWeight: 600,
    letterSpacing: '-0.015em',
    lineHeight: 1.1,
    color: 'var(--color-body-on-dark)',
    marginBottom: 40,
    maxWidth: 520,
  },

  featuresGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: 20,
  },
  featureCell: {
    padding: 24,
    background: 'var(--color-surface-tile-2)',
    borderRadius: 0,
    border: 'none',
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: 'var(--color-surface-chip)',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  featureTitle: { fontSize: 19, fontWeight: 600, color: 'var(--color-body-on-dark)', marginBottom: 8, letterSpacing: '-0.015em', fontFamily: 'var(--font-display)' },
  featureDesc: { fontSize: 15, color: 'var(--color-body-muted-dark)', lineHeight: 1.5, fontWeight: 400 },

  aboutSection: {
    background: 'var(--color-canvas)',
    borderTop: 'none',
    borderBottom: 'none',
  },
  aboutGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 56,
    alignItems: 'start',
  },
  sectionTitleInk: {
    fontSize: 'clamp(28px, 3.2vw, 40px)',
    fontFamily: 'var(--font-display)',
    fontWeight: 600,
    letterSpacing: '-0.015em',
    lineHeight: 1.1,
    color: 'var(--tf-text)',
    marginBottom: 40,
    maxWidth: 480,
  },
  sectionLabelInk: {
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.06em',
    color: 'var(--tf-muted)',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  aboutBody: { fontSize: 17, color: 'var(--tf-muted)', lineHeight: 1.47, marginTop: 8 },

  footer: {
    background: 'var(--color-canvas-parchment)',
    borderTop: '1px solid var(--tf-border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '32px',
    flexWrap: 'wrap',
    gap: 12,
    maxWidth: '100%',
  },
  footerLogo: { fontSize: 13, fontWeight: 600, color: 'var(--tf-subhead)' },
  footerRight: { fontSize: 12, color: 'var(--tf-muted)' },

  btnPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '14px 28px',
    background: 'var(--color-primary)',
    color: 'var(--color-on-primary)',
    border: `1px solid var(--color-primary)`,
    borderRadius: 9999,
    fontSize: 18,
    fontWeight: 300,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'transform 120ms ease, background 120ms ease',
    textDecoration: 'none',
  },
  btnGhost: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '11px 22px',
    background: 'var(--tf-panel)',
    color: 'var(--color-primary)',
    border: '1px solid var(--color-primary)',
    borderRadius: 9999,
    fontSize: 17,
    fontWeight: 400,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'transform 120ms ease, background 120ms ease',
    textDecoration: 'none',
  },
  btnHeaderGhost: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    background: 'var(--color-ink)',
    color: 'var(--color-body-on-dark)',
    border: 'none',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 400,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textDecoration: 'none',
  },
};

export default function Landing() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  function scrollTo(href) {
    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <div style={S.page}>
      <header style={S.header(scrolled)}>
        <a href="/" style={S.logo}>
          <Zap size={18} color="#ffffff" strokeWidth={2} />
          <span style={S.logoText}>TaskFlow</span>
        </a>

        <nav style={S.nav}>
          {NAV_LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              style={S.navLink}
              onClick={(e) => {
                e.preventDefault();
                scrollTo(l.href);
              }}
              onMouseEnter={(e) => {
                e.target.style.color = 'rgba(255,255,255,0.95)';
              }}
              onMouseLeave={(e) => {
                e.target.style.color = 'rgba(255,255,255,0.65)';
              }}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div style={S.headerActions}>
          <button type="button" style={S.btnHeaderGhost} onClick={() => navigate('/login')}>
            Sign In
          </button>
          <button
            type="button"
            style={S.btnPrimary}
            onClick={() => navigate('/login')}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'scale(0.96)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            Get Started <ArrowRight size={16} strokeWidth={1.8} />
          </button>
        </div>
      </header>

      <section style={S.hero}>
        <p style={S.heroTag}>AI-powered task management</p>
        <h1 style={S.heroH1}>
          Every task.<br />Every deadline.<br />Under control.
        </h1>
        <p style={S.heroSub}>
          Assign tasks, track progress, and send AI-written reminders — all from one dashboard built for serious teams.
        </p>
        <div style={S.heroActions}>
          <button
            type="button"
            style={S.btnPrimary}
            onClick={() => navigate('/login')}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'scale(0.96)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            Get Started <ArrowRight size={16} strokeWidth={1.8} />
          </button>
          <button type="button" style={S.btnGhost} onClick={() => scrollTo('#features')}>
            See Features
          </button>
        </div>
      </section>

      {/* Features */}
      <section
        id="features"
        style={{
          scrollMarginTop: 52,
          background: 'var(--color-surface-tile-1)',
          padding: '72px 0',
        }}
      >
        <div style={{ ...S.section, maxWidth: 1060 }}>
          <p style={S.sectionLabel}>Features</p>
          <h2 style={{ ...S.sectionTitle, marginBottom: 44 }}>Everything your team needs. Nothing it doesn't.</h2>
          <div style={S.featuresGrid}>
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} style={S.featureCell}>
                <div style={S.featureIcon}>
                  <Icon size={18} color="#1d1d1f" strokeWidth={2} />
                </div>
                <div style={S.featureTitle}>{title}</div>
                <p style={S.featureDesc}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="about" style={{ ...S.aboutSection, ...S.section, scrollMarginTop: 52 }}>
        <div style={S.aboutGrid}>
          <div>
            <p style={S.sectionLabelInk}>About</p>
            <h2 style={{ ...S.sectionTitleInk, marginBottom: 0 }}>Built for companies that move fast.</h2>
          </div>
          <div>
            <p style={S.aboutBody}>
              TaskFlow was designed for internal teams that need clarity without complexity. Admins get full visibility — create tasks, assign them, and trigger AI-written email reminders in one click. Employees get a focused view of exactly what's on their plate, with real-time updates when things change.
            </p>
            <p style={{ ...S.aboutBody, marginTop: 16 }}>
              Powered by OpenRouter for AI, Supabase for data and auth, and Brevo for email delivery. No subscriptions, no bloat — just a tool that does its job.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={S.footer}>
        <span style={S.footerLogo}>TaskFlow</span>
        <span style={S.footerRight}>{new Date().getFullYear()} — All rights reserved</span>
      </footer>
    </div>
  );
}
