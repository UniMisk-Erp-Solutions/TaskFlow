import React, { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useAuth } from '../AuthContext';
import {
  connect as gcalConnect,
  disconnect as gcalDisconnect,
  isConnected as gcalIsConnected,
  getConnectedEmail as gcalEmail,
  isConfigured as gcalConfigured,
} from '../lib/googleCalendar';

/**
 * Reusable Google account connection card.
 *
 * One click for the end user:
 *   1. Click "Sign in with Google"
 *   2. Pick the Gmail in the Google popup
 *   3. Click "Continue" → calendar sync is on
 *
 * Renders a Google-branded sign-in button when disconnected, and a clean
 * "Connected as you@example.com" panel with a Switch account / Disconnect
 * row when connected.
 *
 *   variant="card"   → bordered panel with title + description (Settings page)
 *   variant="inline" → compact button only (Calendar page header)
 */

function GoogleG({ size = 18 }) {
  // Official Google G mark (svg, brand-colored, exactly as the brand
  // guidelines require for the "Sign in with Google" button).
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.88 2.68-6.63z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.97v2.33A8.99 8.99 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.97A8.99 8.99 0 0 0 0 9c0 1.45.35 2.83.97 4.05l3-2.33z"/>
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A8.99 8.99 0 0 0 .97 4.95l3 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
    </svg>
  );
}

function SignInWithGoogleButton({ onClick, busy, fullWidth = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        height: 44,
        padding: '0 20px',
        borderRadius: 8,
        background: '#fff',
        color: '#1f1f1f',
        fontFamily: '"Roboto", "Inter", system-ui, sans-serif',
        fontSize: 14,
        fontWeight: 500,
        letterSpacing: '0.01em',
        border: '1px solid #dadce0',
        cursor: busy ? 'default' : 'pointer',
        boxShadow: '0 1px 2px rgba(60,64,67,0.08), 0 1px 3px rgba(60,64,67,0.10)',
        transition: 'background 120ms, box-shadow 120ms',
        opacity: busy ? 0.7 : 1,
        width: fullWidth ? '100%' : 'auto',
      }}
      onMouseEnter={(e) => {
        if (busy) return;
        e.currentTarget.style.background = '#f8f9fa';
        e.currentTarget.style.boxShadow = '0 2px 4px rgba(60,64,67,0.12), 0 2px 6px rgba(60,64,67,0.14)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = '#fff';
        e.currentTarget.style.boxShadow = '0 1px 2px rgba(60,64,67,0.08), 0 1px 3px rgba(60,64,67,0.10)';
      }}
    >
      {busy ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <GoogleG />}
      Sign in with Google
    </button>
  );
}

export default function GoogleConnectCard({ variant = 'card' }) {
  const { profile } = useAuth();
  const uid = profile?.id || 'anon';
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const configured = gcalConfigured();
  const connected = gcalIsConnected(uid);
  const email = connected ? gcalEmail(uid) : null;

  useEffect(() => {
    const fn = () => setTick((x) => x + 1);
    window.addEventListener('storage', fn);
    return () => window.removeEventListener('storage', fn);
  }, []);

  async function doConnect(prompt = 'consent') {
    setErr('');
    setBusy(true);
    try {
      await gcalConnect({ userId: uid, prompt });
      setTick((x) => x + 1);
    } catch (e) {
      setErr(e.message || 'Could not connect Google Calendar.');
    } finally {
      setBusy(false);
    }
  }

  async function doDisconnect() {
    setBusy(true);
    try {
      await gcalDisconnect({ userId: uid });
      setTick((x) => x + 1);
    } finally {
      setBusy(false);
    }
  }

  // Inline variant — used in the Calendar page header
  if (variant === 'inline') {
    if (!configured) {
      return (
        <span style={inlineMutedChip}>Google Calendar not configured by admin</span>
      );
    }
    if (connected) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={connectedPill} title={`Connected as ${email || ''}`}>
            <CheckCircle2 size={13} />
            Connected{email ? ` · ${email}` : ''}
          </span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={doDisconnect} disabled={busy}>
            Disconnect
          </button>
        </span>
      );
    }
    return (
      <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
        <SignInWithGoogleButton onClick={() => doConnect('consent')} busy={busy} />
        {err && <span style={{ ...errorBox, maxWidth: 320 }}>{err}</span>}
      </span>
    );
  }

  // Card variant — used in Settings
  return (
    <div
      style={{
        border: '1px solid var(--tf-border)',
        borderRadius: 14,
        background: 'var(--tf-panel)',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div
          style={{
            width: 44, height: 44, borderRadius: 12,
            background: '#fff',
            border: '1px solid var(--tf-border)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <GoogleG size={22} />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--tf-text)', letterSpacing: '-0.005em' }}>
              Google Calendar
            </h3>
            {connected && (
              <span style={connectedPill}>
                <CheckCircle2 size={13} />
                Connected
              </span>
            )}
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--tf-muted)', lineHeight: 1.55 }}>
            {connected
              ? <>Meetings you create can be pushed straight to <strong style={{ color: 'var(--tf-text)' }}>{email || 'your Google Calendar'}</strong>. Toggle the option on the New Meeting form.</>
              : <>Sign in once with Google. Choose any account you're already signed into — we'll only ask for permission to create calendar events.</>
            }
          </p>
        </div>
      </div>

      {!configured && (
        <div style={infoBox}>
          Your workspace admin hasn't enabled Google Calendar sync yet. Once a
          Google OAuth client ID is set in the environment, this card will
          show a "Sign in with Google" button to every user.
        </div>
      )}

      {configured && !connected && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SignInWithGoogleButton onClick={() => doConnect('consent')} busy={busy} />
          {err && <div style={errorBox}>{err}</div>}
          <ul style={featureList}>
            <li>One click — no copy-pasting of API keys</li>
            <li>Pick any Gmail you're signed into in this browser</li>
            <li>Disconnect any time, your data stays in TaskFlow</li>
          </ul>
        </div>
      )}

      {configured && connected && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => doConnect('consent')}
            disabled={busy}
            title="Pick a different Google account"
          >
            Switch account
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={doDisconnect}
            disabled={busy}
            style={{ color: 'var(--status-danger)' }}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}

// ── styles ─────────────────────────────────────────────────────────────
const connectedPill = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 10px',
  borderRadius: 999,
  background: 'rgba(26,174,57,0.10)',
  color: '#1aae39',
  border: '1px solid rgba(26,174,57,0.30)',
  fontSize: 12,
  fontWeight: 600,
};

const inlineMutedChip = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 10px',
  borderRadius: 999,
  background: 'var(--tf-pearl)',
  color: 'var(--tf-muted)',
  border: '1px dashed var(--tf-border)',
  fontSize: 12,
  fontWeight: 500,
};

const featureList = {
  margin: 0,
  paddingLeft: 18,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 12,
  color: 'var(--tf-muted)',
  lineHeight: 1.55,
};

const errorBox = {
  fontSize: 12,
  color: 'var(--status-danger)',
  padding: '8px 10px',
  borderRadius: 8,
  background: 'var(--status-danger-bg)',
  border: '1px solid rgba(224,49,49,0.25)',
};

const infoBox = {
  fontSize: 12,
  color: 'var(--tf-muted)',
  padding: '10px 12px',
  borderRadius: 8,
  background: 'var(--tf-pearl)',
  border: '1px solid var(--tf-border)',
  lineHeight: 1.55,
};
