import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { KeyRound, Mail, User } from 'lucide-react';
import { useAuth } from './AuthContext';
import { getRememberMe, getRememberedEmail, rememberEmail, setRememberMe } from './rememberMe';

// The sign-in and sign-up screens: a dark window on a blue gradient, an illustration on the left and the form on the right.
const AUTH_VARS = {
  '--tf-text': '#f4f7ff',
  '--tf-muted': '#8a93a8',
  '--color-primary': '#8b5cf6',
};

const AUTH_CSS = `
.auth-page{min-height:100vh;padding:34px;display:flex;background:radial-gradient(90% 55% at 50% -10%,rgba(139,92,246,.16) 0%,rgba(139,92,246,0) 62%),radial-gradient(55% 40% at 100% 100%,rgba(139,92,246,.10) 0%,rgba(139,92,246,0) 70%),#030303}
.auth-window{position:relative;overflow:hidden;flex:1;min-height:calc(100vh - 68px);border-radius:34px;background:#070707;border:1px solid rgba(255,255,255,.12);box-shadow:0 40px 110px -40px rgba(139,92,246,.35)}
.auth-glow{position:absolute;inset:0;background:radial-gradient(55% 60% at 100% 0%,rgba(139,92,246,.14) 0%,rgba(5,5,5,0) 70%),radial-gradient(40% 40% at 0% 100%,rgba(255,255,255,.04) 0%,rgba(5,5,5,0) 70%);pointer-events:none}
.auth-ring{position:absolute;left:-90px;bottom:-190px;width:420px;height:420px;border-radius:50%;background:rgba(255,255,255,.035);pointer-events:none}
.auth-logo{position:absolute;z-index:2;left:30px;top:26px;display:inline-flex;align-items:center;gap:10px;color:#fff;text-decoration:none;font-family:var(--font-display);font-size:21px;font-weight:600;letter-spacing:-.01em}
.auth-logo-mark{display:block;width:36px;height:36px;border-radius:10px}
.auth-grid{position:relative;z-index:1;min-height:calc(100vh - 68px);display:grid;grid-template-columns:minmax(0,1fr);justify-items:center;align-items:center;padding:84px 24px 56px}
.auth-form{justify-self:center;width:min(100%,380px)}
.auth-form h1{margin:0 0 8px;font-family:var(--font-display);font-size:25px;font-weight:500;letter-spacing:-.02em;color:#fff}
.auth-sub{margin:0 0 24px;font-size:14px;color:#6f7a90;line-height:1.5}
.auth-field{display:flex;align-items:center;gap:12px;height:48px;padding:0 16px;border-radius:9px;border:1px solid rgba(255,255,255,.2);background:transparent;color:#fff;cursor:text;transition:border-color .15s}
.auth-field:focus-within{border-color:#8b5cf6;box-shadow:0 0 0 3px rgba(139,92,246,.22)}
.auth-field svg{flex:none;color:#fff}
.auth-field input{flex:1;min-width:0;background:transparent;border:0;outline:0;color:#fff;font:inherit;font-size:14px;font-weight:600}
.auth-field input::placeholder{color:#8f98ad;font-weight:500}
.auth-show{flex:none;background:none;border:0;color:#fff;font:inherit;font-size:12px;font-weight:600;cursor:pointer;padding:4px}
.auth-check{display:flex;align-items:center;gap:10px;font-size:12px;color:#d6dcef;cursor:pointer}
.auth-check input{width:18px;height:18px;accent-color:#8b5cf6;flex:none;cursor:pointer}
.auth-check a{color:#fff;text-decoration:underline}
.auth-submit{display:flex;align-items:center;justify-content:center;height:46px;margin-top:6px;border:0;border-radius:7px;background:#8b5cf6;color:#fff;font:inherit;font-size:14px;font-weight:600;cursor:pointer;transition:background .15s,box-shadow .15s;box-shadow:0 12px 28px -12px rgba(139,92,246,.75)}
.auth-submit:hover:not(:disabled){background:#9d7bff}
.auth-submit:disabled{opacity:.6;cursor:default}
.auth-switch{margin:22px 0 0;text-align:center;font-size:13px;color:#6f7a90}
.auth-switch button{background:none;border:0;padding:0;color:#a58bff;font:inherit;font-weight:700;cursor:pointer}
@media (max-width:900px){
  .auth-page{padding:14px}
  .auth-window{border-radius:26px;min-height:calc(100vh - 28px)}
  .auth-grid{min-height:0;padding:84px 20px 40px}
}
`;

/** Turn a failed request into something a person can act on (axios only says "status code 401"). */
function friendlyError(err) {
  const status = err?.response?.status;
  const fromServer = err?.response?.data?.error;
  if (status === 401) return 'Incorrect email or password. Please check them and try again.';
  if (status === 429) return 'Too many attempts. Please wait a minute and try again.';
  if (typeof fromServer === 'string' && fromServer) return fromServer;
  if (err?.code === 'ERR_NETWORK') return 'Could not reach the server. Check your internet connection and try again.';
  return err?.message || 'Something went wrong';
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signUp } = useAuth();

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
        setRememberMe(remember);
        await signUp(email, password, name.trim(), 'admin');
        rememberEmail(email, remember);
      }
      // Back to where the person came from (e.g. the pricing page) when it is a path inside this site.
      const next = new URLSearchParams(location.search).get('next');
      navigate(next && /^\/(?![/\\])/.test(next) ? next : '/app');
    } catch (err) {
      setError(friendlyError(err));
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

              {mode === 'signup' && (
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
