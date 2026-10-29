import React, { lazy, Suspense, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { BillingProvider } from './BillingContext';
import SubscriptionGate from './components/SubscriptionGate';
import { ThemeProvider } from './ThemeContext';
import Seo, { NoIndex } from './seo/Seo';
import { LANDING_PAGES, BLOG_POSTS } from './seo/seoPages.js';

// The app screens are big (dashboards, charts, whiteboard). They load only when someone opens them, so the public pages stay light.
const Login = lazy(() => import('./Login'));
const AdminDashboard = lazy(() => import('./AdminDashboard'));
const EmployeeDashboard = lazy(() => import('./EmployeeDashboard'));
const Onboarding = lazy(() => import('./Onboarding'));
const PendingApproval = lazy(() => import('./PendingApproval'));
import PwaPrompt from './components/PwaPrompt';
import PushPrompt from './components/PushPrompt';

// Marketing (public) surfaces — ported from the standalone "quest" landing
// page. They are Tailwind v4 + framer-motion and live entirely under
// `src/landing/*`. None of them touch auth, supabase, or any backend
// surface.
import { Navbar as MarketingNavbar } from './landing/components/layout/Navbar';
import { Footer as MarketingFooter } from './landing/components/layout/Footer';
import ScrollToTop from './landing/components/layout/ScrollToTop';
import Home from './landing/pages/Home';
const Features = lazy(() => import('./landing/pages/Features'));
const Pricing = lazy(() => import('./landing/pages/Pricing'));
const About = lazy(() => import('./landing/pages/About'));
const Contact = lazy(() => import('./landing/pages/Contact'));
const Security = lazy(() => import('./landing/pages/Security'));
const Privacy = lazy(() => import('./landing/pages/Privacy'));
const Terms = lazy(() => import('./landing/pages/Terms'));
const Docs = lazy(() => import('./landing/pages/Docs'));
const Faq = lazy(() => import('./landing/pages/Faq'));
const SeoLanding = lazy(() => import('./landing/pages/SeoLanding'));
const BlogIndex = lazy(() => import('./landing/pages/Blog').then((m) => ({ default: m.BlogIndex })));
const BlogPost = lazy(() => import('./landing/pages/Blog'));
const NotFound = lazy(() => import('./landing/pages/NotFound'));

function MarketingLayout({ children, seo }) {
  return (
    <div className="flex flex-col min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      {seo && <Seo path={seo} />}
      <ScrollToTop />
      <MarketingNavbar />
      <main className="flex-grow">{children}</main>
      <MarketingFooter />
    </div>
  );
}

function BlogPostRoute() {
  const { slug } = useParams();
  return BLOG_POSTS.some((p) => p.slug === slug) ? <BlogPost slug={slug} /> : <NotFound />;
}

/** App screens: not for search results. */
function AppScreen({ children }) {
  return (
    <>
      <NoIndex />
      {children}
    </>
  );
}

function ProfileLoadError() {
  const { refreshProfile, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--tf-page)',
        padding: 24,
        textAlign: 'center',
        gap: 14,
      }}
    >
      <p style={{ fontSize: 17, color: 'var(--tf-muted)', maxWidth: 420, lineHeight: 1.47 }}>
        You are signed in, but your workspace profile could not be loaded. This is usually a wrong API URL in the
        build or a network issue.
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await refreshProfile();
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Retry'}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => signOut()}>
          Sign out
        </button>
        <Link to="/login" className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>
          Back to login
        </Link>
      </div>
    </div>
  );
}

/**
 * Accounts without an organization (fresh email/password signup, or a first-time
 * Google sign-in) must finish onboarding: verify phone -> create org OR join by code.
 * Returns a screen to render, or null when the user is fully set up.
 * Older profiles have no `status` field — treat those as active so nothing regresses.
 */
function onboardingScreen(profile) {
  const status = profile?.status ?? 'active';
  if (status === 'needs_onboarding') return <Onboarding />;
  if (status === 'pending_approval' || status === 'rejected') return <PendingApproval />;
  return null;
}

function RoleRouter() {
  const { user, profile, loading } = useAuth();
  if (loading && !profile) return <FullLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile) return <ProfileLoadError />;

  const gate = onboardingScreen(profile);
  if (gate) return gate;

  const userRole = profile?.role;
  const base = userRole === 'admin' ? '/admin' : userRole === 'manager' ? '/manager' : '/dashboard';
  // Push notifications open /app?open=chat so each role lands on its own chat tab.
  const open = new URLSearchParams(window.location.search).get('open');
  return <Navigate to={open === 'chat' ? base + '/chat' : base} replace />;
}

function ProtectedAdmin({ children }) {
  const { user, profile, loading } = useAuth();
  if (loading && !profile) return <FullLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile) return <ProfileLoadError />;
  if (onboardingScreen(profile)) return <Navigate to="/app" replace />;

  const userRole = profile?.role;
  if (userRole !== 'admin') return <Navigate to={userRole === 'manager' ? '/manager' : '/dashboard'} replace />;
  return children;
}

function ProtectedManager({ children }) {
  const { user, profile, loading } = useAuth();
  if (loading && !profile) return <FullLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile) return <ProfileLoadError />;
  if (onboardingScreen(profile)) return <Navigate to="/app" replace />;
  if (profile.role !== 'manager') return <Navigate to="/app" replace />;
  return children;
}

function ProtectedEmployee({ children }) {
  const { user, profile, loading } = useAuth();
  if (loading && !profile) return <FullLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile) return <ProfileLoadError />;
  if (onboardingScreen(profile)) return <Navigate to="/app" replace />;
  if (profile.role === 'manager') return <Navigate to="/manager" replace />;
  return children;
}

function FullLoader() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--tf-page)' }}>
      <div className="spinner" style={{ width: 22, height: 22 }} />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <BillingProvider>
          <Suspense fallback={<FullLoader />}>
          <Routes>
            {/* Marketing / public surfaces. */}
            {/* Marketing / public surfaces. Each one sets its own title, description, canonical and structured data. */}
            <Route path="/"          element={<MarketingLayout seo="/"><Home /></MarketingLayout>} />
            <Route path="/features"  element={<MarketingLayout seo="/features"><Features /></MarketingLayout>} />
            <Route path="/pricing"   element={<MarketingLayout seo="/pricing"><Pricing /></MarketingLayout>} />
            <Route path="/about"     element={<MarketingLayout seo="/about"><About /></MarketingLayout>} />
            <Route path="/contact"   element={<MarketingLayout seo="/contact"><Contact /></MarketingLayout>} />
            <Route path="/security"  element={<MarketingLayout seo="/security"><Security /></MarketingLayout>} />
            <Route path="/privacy"   element={<MarketingLayout seo="/privacy"><Privacy /></MarketingLayout>} />
            <Route path="/terms"     element={<MarketingLayout seo="/terms"><Terms /></MarketingLayout>} />
            <Route path="/docs"      element={<MarketingLayout seo="/docs"><Docs /></MarketingLayout>} />
            <Route path="/faq"       element={<MarketingLayout seo="/faq"><Faq /></MarketingLayout>} />
            {LANDING_PAGES.map((page) => (
              <Route key={page.path} path={page.path} element={<MarketingLayout><SeoLanding path={page.path} /></MarketingLayout>} />
            ))}
            <Route path="/blog"      element={<MarketingLayout><BlogIndex /></MarketingLayout>} />
            <Route path="/blog/:slug" element={<MarketingLayout><BlogPostRoute /></MarketingLayout>} />

            {/* Auth + product: kept out of search results. */}
            <Route path="/login"     element={<AppScreen><Login /></AppScreen>} />
            <Route path="/signup"    element={<Navigate to="/login?mode=signup" replace />} />
            <Route path="/app"       element={<AppScreen><RoleRouter /></AppScreen>} />
            <Route path="/admin"     element={<Navigate to="/admin/overview" replace />} />
            <Route path="/admin/*"  element={<AppScreen><ProtectedAdmin><AdminDashboard /></ProtectedAdmin></AppScreen>} />
            <Route path="/dashboard" element={<Navigate to="/dashboard/tasks" replace />} />
            <Route path="/manager" element={<Navigate to="/manager/tasks" replace />} />
            <Route path="/manager/*" element={<AppScreen><ProtectedManager><EmployeeDashboard role="manager" /></ProtectedManager></AppScreen>} />
            <Route path="/dashboard/*" element={<AppScreen><ProtectedEmployee><EmployeeDashboard /></ProtectedEmployee></AppScreen>} />

            {/* Unknown URLs get a real "not found" page (noindex) instead of silently showing the home page. */}
            <Route path="*"          element={<MarketingLayout><NotFound /></MarketingLayout>} />
          </Routes>
          </Suspense>
          <PwaPrompt />
          <PushPrompt />
          <SubscriptionGate />
          </BillingProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
