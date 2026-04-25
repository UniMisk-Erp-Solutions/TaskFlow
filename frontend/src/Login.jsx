import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Zap, ArrowLeft } from 'lucide-react';
import { useAuth } from './AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();

  const [mode,     setMode]     = useState('signin');
  const [role,     setRole]     = useState('employee');
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
      } else {
        if (!name.trim()) { setError('Full name is required'); setLoading(false); return; }
        await signUp(email, password, name.trim(), role);
      }
      navigate('/app');
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#080808',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      {/* Top bar */}
      <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e1e1e' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 7, textDecoration: 'none', color: '#666', fontSize: 13 }}>
          <ArrowLeft size={14} /> Back
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Zap size={14} color="#e4e4e4" strokeWidth={1.5} />
          <span style={{ fontSize: 14, fontWeight: 600, color: '#e4e4e4', letterSpacing: '-0.2px' }}>TaskFlow</span>
        </div>
        <div style={{ width: 60 }} />
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div style={{ width: '100%', maxWidth: 360 }}>

          {/* Heading */}
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: '#e4e4e4', letterSpacing: '-0.3px', marginBottom: 6 }}>
              {mode === 'signin' ? 'Welcome back' : 'Create an account'}
            </h1>
            <p style={{ fontSize: 13, color: '#555' }}>
              {mode === 'signin' ? 'Sign in to your TaskFlow workspace' : 'Set up your account to get started'}
            </p>
          </div>

          {/* Tab toggle */}
          <div style={{ display: 'flex', background: '#0e0e0e', border: '1px solid #1e1e1e', borderRadius: 6, padding: 3, marginBottom: 24 }}>
            {['signin', 'signup'].map((m) => (
              <button key={m} onClick={() => { setMode(m); setError(''); }}
                style={{
                  flex: 1, padding: '7px 0', border: 'none', cursor: 'pointer', borderRadius: 4,
                  fontSize: 13, fontWeight: 500, fontFamily: 'inherit', transition: 'all 100ms ease',
                  background: mode === m ? '#191919' : 'transparent',
                  color: mode === m ? '#e4e4e4' : '#555',
                }}>
                {m === 'signin' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          {/* Role selector — signup only */}
          {mode === 'signup' && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: '#444', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 10 }}>Role</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { value: 'admin',    label: 'Administrator', desc: 'Manage tasks, team & reminders' },
                  { value: 'employee', label: 'Employee',       desc: 'View and update your own tasks' },
                ].map((r) => {
                  const active = role === r.value;
                  return (
                    <button key={r.value} onClick={() => setRole(r.value)} type="button" style={{
                      padding: '12px 14px', textAlign: 'left', cursor: 'pointer',
                      background: active ? '#131313' : '#0e0e0e',
                      border: `1px solid ${active ? '#383838' : '#1e1e1e'}`,
                      borderRadius: 6, fontFamily: 'inherit', transition: 'all 100ms ease',
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: active ? '#e4e4e4' : '#555', marginBottom: 3 }}>
                        {r.label}
                      </div>
                      <div style={{ fontSize: 11, color: '#3a3a3a', lineHeight: 1.4 }}>{r.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {mode === 'signup' && (
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="input" type="text" placeholder="Jane Smith" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="input" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input" type={showPw ? 'text' : 'password'}
                  placeholder="••••••••" style={{ paddingRight: 38 }}
                  value={password} onChange={(e) => setPassword(e.target.value)} required
                />
                <button type="button" onClick={() => setShowPw(!showPw)} style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: '#444', display: 'flex', padding: 2,
                }}>
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {error && <div className="form-error" style={{ marginTop: -4 }}>{error}</div>}

            <button className="btn btn-primary" type="submit" disabled={loading}
              style={{ marginTop: 4, justifyContent: 'center', width: '100%', padding: '10px' }}>
              {loading
                ? <span className="spinner" />
                : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <p style={{ marginTop: 20, fontSize: 12, color: '#444', textAlign: 'center', lineHeight: 1.6 }}>
            By continuing, you agree to TaskFlow's terms of service and privacy policy.
          </p>
        </div>
      </div>
    </div>
  );
}
