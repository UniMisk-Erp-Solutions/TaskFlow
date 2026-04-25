import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, CheckSquare, Bell, Users, ArrowRight, Menu, X } from 'lucide-react';

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
  page: { background: '#080808', minHeight: '100vh', color: '#e4e4e4', fontFamily: "'Inter', -apple-system, sans-serif" },

  // Header
  header: (scrolled) => ({
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
    height: 56, display: 'flex', alignItems: 'center',
    padding: '0 32px', justifyContent: 'space-between',
    background: scrolled ? 'rgba(8,8,8,0.95)' : 'transparent',
    borderBottom: scrolled ? '1px solid #1e1e1e' : '1px solid transparent',
    backdropFilter: scrolled ? 'blur(12px)' : 'none',
    transition: 'all 200ms ease',
  }),
  logo: { display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' },
  logoText: { fontSize: 15, fontWeight: 700, color: '#e4e4e4', letterSpacing: '-0.3px' },
  nav: { display: 'flex', alignItems: 'center', gap: 28 },
  navLink: { fontSize: 13, color: '#666', textDecoration: 'none', transition: 'color 100ms ease' },
  headerActions: { display: 'flex', alignItems: 'center', gap: 10 },

  // Hero
  hero: {
    minHeight: '92vh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    textAlign: 'center', padding: '80px 24px 60px',
    borderBottom: '1px solid #1e1e1e',
  },
  heroTag: {
    fontSize: 10, fontWeight: 600, letterSpacing: '2px',
    color: '#444', textTransform: 'uppercase', marginBottom: 28,
  },
  heroH1: {
    fontSize: 'clamp(42px, 6vw, 72px)',
    fontWeight: 500, letterSpacing: '-2.5px',
    lineHeight: 1.05, maxWidth: 760, marginBottom: 24,
    color: '#e8e8e8',
  },
  heroSub: {
    fontSize: 17, fontWeight: 400, color: '#555',
    maxWidth: 440, lineHeight: 1.7, marginBottom: 40,
  },
  heroActions: { display: 'flex', gap: 10, alignItems: 'center' },

  // Section
  section: { maxWidth: 1000, margin: '0 auto', padding: '80px 32px' },
  sectionLabel: {
    fontSize: 10, fontWeight: 600, letterSpacing: '2.5px',
    color: '#444', textTransform: 'uppercase', marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 'clamp(24px, 3vw, 36px)',
    fontWeight: 500, letterSpacing: '-1px',
    color: '#e8e8e8', marginBottom: 56,
    maxWidth: 480,
  },

  // Features grid
  featuresGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 1, border: '1px solid #1e1e1e', borderRadius: 8, overflow: 'hidden',
  },
  featureCell: {
    padding: '28px 24px', background: '#0e0e0e',
    borderRight: '1px solid #1e1e1e', borderBottom: '1px solid #1e1e1e',
  },
  featureIcon: {
    width: 32, height: 32, borderRadius: 6,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid #1e1e1e',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  featureTitle: { fontSize: 14, fontWeight: 600, color: '#e4e4e4', marginBottom: 8 },
  featureDesc: { fontSize: 13, color: '#555', lineHeight: 1.7 },

  // About
  aboutGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60,
    alignItems: 'start',
    borderTop: '1px solid #1e1e1e', paddingTop: 80,
  },
  aboutBody: { fontSize: 14, color: '#555', lineHeight: 1.9, marginTop: 16 },

  // Footer
  footer: {
    borderTop: '1px solid #1e1e1e',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '22px 32px', maxWidth: '100%',
  },
  footerLogo: { fontSize: 13, fontWeight: 600, color: '#444' },
  footerRight: { fontSize: 12, color: '#333' },

  // Buttons
  btnWhite: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '9px 18px', background: '#e4e4e4', color: '#080808',
    border: '1px solid #e4e4e4', borderRadius: 4,
    fontSize: 13, fontWeight: 500, cursor: 'pointer',
    fontFamily: 'inherit', transition: 'background 100ms ease',
    textDecoration: 'none',
  },
  btnGhost: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '9px 18px', background: 'transparent', color: '#666',
    border: '1px solid #2a2a2a', borderRadius: 4,
    fontSize: 13, fontWeight: 500, cursor: 'pointer',
    fontFamily: 'inherit', transition: 'all 100ms ease',
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
      {/* Header */}
      <header style={S.header(scrolled)}>
        <a href="/" style={S.logo}>
          <Zap size={16} color="#e4e4e4" strokeWidth={1.5} />
          <span style={S.logoText}>TaskFlow</span>
        </a>

        <nav style={S.nav}>
          {NAV_LINKS.map((l) => (
            <a
              key={l.label} href={l.href} style={S.navLink}
              onClick={(e) => { e.preventDefault(); scrollTo(l.href); }}
              onMouseEnter={(e) => (e.target.style.color = '#e4e4e4')}
              onMouseLeave={(e) => (e.target.style.color = '#666')}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div style={S.headerActions}>
          <button style={S.btnGhost} onClick={() => navigate('/login')}
            onMouseEnter={(e) => { e.currentTarget.style.color='#e4e4e4'; e.currentTarget.style.borderColor='#383838'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color='#666'; e.currentTarget.style.borderColor='#2a2a2a'; }}>
            Sign In
          </button>
          <button style={S.btnWhite} onClick={() => navigate('/login')}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#ffffff')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#e4e4e4')}>
            Get Started <ArrowRight size={13} />
          </button>
        </div>
      </header>

      {/* Hero */}
      <section style={S.hero}>
        <p style={S.heroTag}>AI-powered task management</p>
        <h1 style={S.heroH1}>
          Every task.<br />Every deadline.<br />Under control.
        </h1>
        <p style={S.heroSub}>
          Assign tasks, track progress, and send AI-written reminders — all from one dashboard built for serious teams.
        </p>
        <div style={S.heroActions}>
          <button style={S.btnWhite} onClick={() => navigate('/login')}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#ffffff')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#e4e4e4')}>
            Get Started <ArrowRight size={13} />
          </button>
          <button style={S.btnGhost} onClick={() => scrollTo('#features')}
            onMouseEnter={(e) => { e.currentTarget.style.color='#e4e4e4'; e.currentTarget.style.borderColor='#383838'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color='#666'; e.currentTarget.style.borderColor='#2a2a2a'; }}>
            See Features
          </button>
        </div>
      </section>

      {/* Features */}
      <section id="features" style={{ ...S.section, scrollMarginTop: 56 }}>
        <p style={S.sectionLabel}>Features</p>
        <h2 style={S.sectionTitle}>Everything your team needs. Nothing it doesn't.</h2>
        <div style={S.featuresGrid}>
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} style={S.featureCell}>
              <div style={S.featureIcon}>
                <Icon size={14} color="#666" strokeWidth={1.5} />
              </div>
              <div style={S.featureTitle}>{title}</div>
              <p style={S.featureDesc}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* About */}
      <section id="about" style={{ ...S.section, scrollMarginTop: 56 }}>
        <div style={S.aboutGrid}>
          <div>
            <p style={S.sectionLabel}>About</p>
            <h2 style={{ ...S.sectionTitle, marginBottom: 0 }}>
              Built for companies that move fast.
            </h2>
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
