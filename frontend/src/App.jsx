import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import Landing from './Landing';
import Login from './Login';
import AdminDashboard from './AdminDashboard';
import EmployeeDashboard from './EmployeeDashboard';

function RoleRouter() {
  const { user, profile, loading } = useAuth();
  if (loading) return <FullLoader />;
  if (!user) return <Navigate to="/login" replace />;

  // Use role from database profile only (authoritative)
  const userRole = profile?.role;
  if (userRole === 'admin') return <Navigate to="/admin" replace />;
  return <Navigate to="/dashboard" replace />;
}

function ProtectedAdmin({ children }) {
  const { user, profile, loading } = useAuth();
  if (loading) return <FullLoader />;
  if (!user) return <Navigate to="/login" replace />;

  // Use role from database profile only (authoritative)
  const userRole = profile?.role;
  if (userRole !== 'admin') return <Navigate to="/dashboard" replace />;
  return children;
}

function ProtectedEmployee({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function FullLoader() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080808' }}>
      <div className="spinner" style={{ width: 22, height: 22 }} />
    </div>
  );
}

export default function App() {
  return (
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
  );
}
