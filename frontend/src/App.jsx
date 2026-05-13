import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { ThemeProvider } from './ThemeContext';
import Landing from './Landing';
import Login from './Login';
import AdminDashboard from './AdminDashboard';
import EmployeeDashboard from './EmployeeDashboard';

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

function RoleRouter() {
  const { user, profile, loading } = useAuth();
  if (loading) return <FullLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile) return <ProfileLoadError />;

  // Use role from database profile only (authoritative)
  const userRole = profile?.role;
  if (userRole === 'admin') return <Navigate to="/admin" replace />;
  return <Navigate to="/dashboard" replace />;
}

function ProtectedAdmin({ children }) {
  const { user, profile, loading } = useAuth();
  if (loading) return <FullLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile) return <ProfileLoadError />;

  // Use role from database profile only (authoritative)
  const userRole = profile?.role;
  if (userRole !== 'admin') return <Navigate to="/dashboard" replace />;
  return children;
}

function ProtectedEmployee({ children }) {
  const { user, profile, loading } = useAuth();
  if (loading) return <FullLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile) return <ProfileLoadError />;
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
          <Routes>
            <Route path="/"          element={<Landing />} />
            <Route path="/login"     element={<Login />} />
            <Route path="/app"       element={<RoleRouter />} />
            <Route path="/admin"     element={<ProtectedAdmin><AdminDashboard /></ProtectedAdmin>} />
            <Route path="/dashboard" element={<ProtectedEmployee><EmployeeDashboard /></ProtectedEmployee>} />
            <Route path="*"          element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
