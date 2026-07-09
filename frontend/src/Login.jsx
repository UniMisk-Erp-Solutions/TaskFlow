import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Eye, EyeOff, Zap, ArrowLeft } from 'lucide-react';
import { useAuth } from './AuthContext';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.6 2.4-7.2 2.4-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.6 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.4l6.2 5.2C39.9 35.7 44 30.5 44 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleGoogle() {
    setError('');
    setGoogleLoading(true);
    try {
      await signInWithGoogle();   // full-page redirect to Google
    } catch (err) {
      setError(err.message || 'Google sign-in is unavailable right now');
      setGoogleLoading(false);
    }
  }

  const initialMode =
    new URLSearchParams(location.search).get('mode') === 'signup' ? 'signup' : 'signin';
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
      } else {
        if (!name.trim()) {
          setError('Full name is required');
          setLoading(false);
          return;
        }
        await signUp(email, password, name.trim(), 'admin');
      }
      navigate('/app');
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--tf-page)', display: 'flex', flexDirection: 'column' }}>
      <div
        className="tf-subnav"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          minHeight: 52,
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          width: '100%',
        }}
      >
        <Link
          to="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            textDecoration: 'none',
            color: 'var(--color-primary)',
            fontSize: 17,
            justifySelf: 'start',
          }}
        >
          <ArrowLeft size={17} strokeWidth={1.8} /> Back
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifySelf: 'center' }}>
          <Zap size={18} color="var(--tf-text)" strokeWidth={2} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 21, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--tf-text)' }}>
            TaskFlow
          </span>
        </div>
        <div />
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 20px' }}>
        <div
          style={{
            width: '100%',
            maxWidth: 400,
            background: 'var(--tf-panel)',
            border: '1px solid var(--tf-border)',
            borderRadius: 18,
            padding: '32px 28px',
          }}
        >
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: 28, fontWeight: 600, color: 'var(--tf-text)', letterSpacing: '-0.02em', marginBottom: 8, fontFamily: 'var(--font-display)' }}>
              {mode === 'signin' ? 'Welcome back' : 'Create an account'}
            </h1>
            <p style={{ fontSize: 17, color: 'var(--tf-muted)', lineHeight: 1.47 }}>
              {mode === 'signin' ? 'Sign in to your TaskFlow workspace' : 'Set up your account to get started'}
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              background: 'var(--tf-pearl)',
              border: '1px solid var(--tf-border)',
              borderRadius: 11,
              padding: 4,
              marginBottom: 24,
            }}
          >
            {['signin', 'signup'].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError('');
                }}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: 8,
                  fontSize: 15,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  transition: 'background 120ms ease, color 120ms ease',
                  background: mode === m ? 'var(--tf-panel)' : 'transparent',
                  color: mode === m ? 'var(--tf-text)' : 'var(--tf-muted)',
                  boxShadow: mode === m ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                {m === 'signin' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                  className="input"
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  style={{ paddingRight: 44 }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--tf-muted)',
                    display: 'flex',
                    padding: 4,
                  }}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff size={18} strokeWidth={1.8} /> : <Eye size={18} strokeWidth={1.8} />}
                </button>
              </div>
            </div>

            {error && <div className="form-error">{error}</div>}

            <button className="btn btn-primary btn-lg" type="submit" disabled={loading} style={{ marginTop: 4, justifyContent: 'center', width: '100%' }}>
              {loading ? <span className="spinner" /> : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0 16px' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--tf-border)' }} />
            <span style={{ fontSize: 12, color: 'var(--tf-muted)' }}>or</span>
            <div style={{ flex: 1, height: 1, background: 'var(--tf-border)' }} />
          </div>

          <button
            type="button"
            className="btn btn-lg"
            disabled={loading || googleLoading}
            onClick={handleGoogle}
            style={{
              width: '100%', justifyContent: 'center', gap: 10,
              background: 'var(--tf-panel)', border: '1px solid var(--tf-border)', color: 'var(--tf-text)',
            }}
          >
            {googleLoading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <GoogleIcon />}
            {googleLoading ? 'Redirecting…' : 'Continue with Google'}
          </button>

          <p style={{ marginTop: 24, fontSize: 12, color: 'var(--tf-muted)', textAlign: 'center', lineHeight: 1.43 }}>
            By continuing, you agree to TaskFlow&apos;s terms of service and privacy policy.
          </p>
        </div>
      </div>
    </div>
  );
}
