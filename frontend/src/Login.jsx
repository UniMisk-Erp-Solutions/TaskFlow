import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { KeyRound, Mail, User } from 'lucide-react';
import { useAuth } from './AuthContext';
import { getRememberMe, getRememberedEmail, rememberEmail, setRememberMe } from './rememberMe';

// The sign-in and sign-up screens: a dark window on a blue gradient, an illustration on the left and the form on the right.
const AUTH_VARS = {
  '--tf-text': '#f4f7ff',
  '--tf-muted': '#8a93a8',
  '--color-primary': '#0a5cff',
};

const AUTH_CSS = `
.auth-page{min-height:100vh;padding:34px;display:flex;background:radial-gradient(90% 55% at 50% -10%,rgba(47,107,255,.34) 0%,rgba(47,107,255,0) 62%),radial-gradient(55% 40% at 100% 100%,rgba(30,80,230,.22) 0%,rgba(30,80,230,0) 70%),#04060f}
.auth-window{position:relative;overflow:hidden;flex:1;min-height:calc(100vh - 68px);border-radius:34px;background:#05070c;border:1px solid rgba(110,150,255,.16);box-shadow:0 40px 110px -40px rgba(30,80,255,.55)}
.auth-glow{position:absolute;inset:0;background:radial-gradient(55% 60% at 100% 0%,rgba(30,70,170,.42) 0%,rgba(5,7,12,0) 70%),radial-gradient(40% 40% at 0% 100%,rgba(40,100,255,.14) 0%,rgba(5,7,12,0) 70%);pointer-events:none}
.auth-ring{position:absolute;left:-90px;bottom:-190px;width:420px;height:420px;border-radius:50%;background:rgba(60,120,255,.07);pointer-events:none}
.auth-logo{position:absolute;z-index:2;left:30px;top:26px;display:inline-flex;align-items:center;gap:10px;color:#fff;text-decoration:none;font-family:var(--font-display);font-size:21px;font-weight:600;letter-spacing:-.01em}
.auth-logo-mark{display:block;width:36px;height:36px;border-radius:10px}
.auth-grid{position:relative;z-index:1;min-height:calc(100vh - 68px);display:grid;grid-template-columns:minmax(0,1.05fr) minmax(300px,1fr);align-items:center;gap:24px;padding:84px 56px 56px}
.auth-art{justify-self:center;width:min(100%,400px)}
.auth-img{display:block;width:100%;height:auto;-webkit-mask-image:radial-gradient(closest-side,#000 58%,rgba(0,0,0,.55) 80%,transparent 97%);mask-image:radial-gradient(closest-side,#000 58%,rgba(0,0,0,.55) 80%,transparent 97%)}
.auth-form{justify-self:center;width:min(100%,350px)}
.auth-form h1{margin:0 0 8px;font-family:var(--font-display);font-size:25px;font-weight:500;letter-spacing:-.02em;color:#fff}
.auth-sub{margin:0 0 24px;font-size:14px;color:#6f7a90;line-height:1.5}
.auth-field{display:flex;align-items:center;gap:12px;height:48px;padding:0 16px;border-radius:9px;border:1px solid rgba(255,255,255,.2);background:transparent;color:#fff;cursor:text;transition:border-color .15s}
.auth-field:focus-within{border-color:#1a5bff;box-shadow:0 0 0 3px rgba(26,91,255,.18)}
.auth-field svg{flex:none;color:#fff}
.auth-field input{flex:1;min-width:0;background:transparent;border:0;outline:0;color:#fff;font:inherit;font-size:14px;font-weight:600}
.auth-field input::placeholder{color:#8f98ad;font-weight:500}
.auth-show{flex:none;background:none;border:0;color:#fff;font:inherit;font-size:12px;font-weight:600;cursor:pointer;padding:4px}
.auth-check{display:flex;align-items:center;gap:10px;font-size:12px;color:#d6dcef;cursor:pointer}
.auth-check input{width:18px;height:18px;accent-color:#0a5cff;flex:none;cursor:pointer}
.auth-check a{color:#fff;text-decoration:underline}
.auth-submit{display:flex;align-items:center;justify-content:center;height:46px;margin-top:6px;border:0;border-radius:7px;background:#8b5cf6;color:#fff;font:inherit;font-size:14px;font-weight:600;cursor:pointer;transition:background .15s,box-shadow .15s;box-shadow:0 12px 28px -12px rgba(139,92,246,.75)}
.auth-submit:hover:not(:disabled){background:#9d7bff}
.auth-submit:disabled{opacity:.6;cursor:default}
.auth-or{display:flex;align-items:center;gap:12px;margin:18px 0 14px;color:#6f7a90;font-size:12px}
.auth-or::before,.auth-or::after{content:'';flex:1;height:1px;background:rgba(255,255,255,.12)}
.auth-google{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;height:44px;border-radius:7px;border:1px solid rgba(255,255,255,.2);background:transparent;color:#fff;font:inherit;font-size:14px;font-weight:500;cursor:pointer;transition:background .15s}
.auth-google:hover:not(:disabled){background:rgba(255,255,255,.06)}
.auth-switch{margin:22px 0 0;text-align:center;font-size:13px;color:#6f7a90}
.auth-switch button{background:none;border:0;padding:0;color:#a58bff;font:inherit;font-weight:700;cursor:pointer}
@media (max-width:900px){
  .auth-page{padding:14px}
  .auth-window{border-radius:26px;min-height:calc(100vh - 28px)}
  .auth-grid{grid-template-columns:1fr;min-height:0;padding:84px 24px 40px;gap:8px}
  .auth-art{width:min(100%,260px)}
}
`;

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
    setRememberMe(remember);
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
  const [email, setEmail] = useState(() => getRememberedEmail());
  const [remember, setRemember] = useState(() => getRememberMe());
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signin') {
        // Decide where the session is kept before it is created.
        setRememberMe(remember);
        await signIn(email, password);
        rememberEmail(email, remember);
      } else {
        if (!name.trim()) {
          setError('Full name is required');
          setLoading(false);
          return;
        }
        await signUp(email, password, name.trim(), 'admin');
      }
      // Back to where the person came from (e.g. the pricing page) when it is a path inside this site.
      const next = new URLSearchParams(location.search).get('next');
      navigate(next && /^\/(?![/\\])/.test(next) ? next : '/app');
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page" style={{ ...AUTH_VARS, color: 'var(--tf-text)' }}>
      <style>{AUTH_CSS}</style>
      <div className="auth-window">
        <div className="auth-glow" aria-hidden="true" />
        <div className="auth-ring" aria-hidden="true" />

        <Link to="/" className="auth-logo" aria-label="TaskFlow home">
          <img className="auth-logo-mark" src="/logo-mark.png" alt="" width="36" height="36" />
          <span>TaskFlow</span>
        </Link>

        <div className="auth-grid">
          <div className="auth-art">
            <img className="auth-img" src="/auth-illustration.png" width="317" height="305" alt="An open chest with a signed document, a padlock, a key and a shield" />
          </div>

          <div className="auth-form">
            <h1>{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h1>
            <p className="auth-sub">
              {mode === 'signup' ? 'Plan, assign and approve work with your team.' : 'Sign in to continue to your workspace.'}
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {mode === 'signup' && (
                <label className="auth-field">
                  <User size={17} />
                  <input type="text" placeholder="Full name" aria-label="Full name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
                </label>
              )}
              <label className="auth-field">
                <Mail size={17} />
                <input type="email" placeholder="you@company.com" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
              </label>
              <label className="auth-field">
                <KeyRound size={17} />
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="Password"
                  aria-label="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  required
                />
                <button type="button" className="auth-show" onClick={() => setShowPw(!showPw)} aria-label={showPw ? 'Hide password' : 'Show password'}>
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </label>

              {mode === 'signin' && (
                <label className="auth-check">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                  <span>Remember me</span>
                </label>
              )}

              {mode === 'signup' && (
                <label className="auth-check">
                  <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} required />
                  <span>
                    I agree to the <Link to="/terms" target="_blank" rel="noreferrer">Terms &amp; Conditions</Link>
                  </span>
                </label>
              )}

              {error && <div className="form-error" role="alert">{error}</div>}

              <button className="auth-submit" type="submit" disabled={loading}>
                {loading ? <span className="spinner" /> : mode === 'signup' ? 'Create my account' : 'Sign in'}
              </button>
            </form>

            <div className="auth-or"><span>or</span></div>
            <button type="button" className="auth-google" disabled={loading || googleLoading} onClick={handleGoogle}>
              {googleLoading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <GoogleIcon />}
              {googleLoading ? 'Redirecting…' : 'Continue with Google'}
            </button>

            <p className="auth-switch">
              {mode === 'signup' ? 'Already have an account? ' : 'New to TaskFlow? '}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'signup' ? 'signin' : 'signup');
                  setError('');
                }}
              >
                {mode === 'signup' ? 'Sign In' : 'Create an account'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
