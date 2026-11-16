import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { useBilling } from '../BillingContext';

const APP_PREFIXES = ['/admin', '/manager', '/dashboard', '/app'];

/**
 * Mandatory payment popup. It appears over the app screens when the SERVER says the workspace is locked (Pro trial over, nothing
 * paid), cannot be dismissed, and goes away only when the server reports the workspace as paid. The API refuses protected
 * requests with 402 in the same situation, so hiding this popup (dev tools, etc.) gives no access.
 */
export default function SubscriptionGate() {
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();
  const { billing, refresh, checkout } = useBilling();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const buttonRef = useRef(null);

  const open = !!(user && billing?.locked && APP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`)));
  useEffect(() => { if (open) buttonRef.current?.focus(); }, [open]);
  useEffect(() => { if (!open) setMessage(''); }, [open]);
  if (!open) return null;

  const admin = !!billing.canManageBilling;
  const last = billing.lastPayment;
  const lastNote = last?.status === 'failed'
    ? `Your last payment failed${last.failure_reason ? ` (${last.failure_reason})` : ''}. Please try again.`
    : last?.status === 'cancelled'
      ? 'The last payment was cancelled. Your workspace stays locked until a payment goes through.'
      : '';

  async function pay() {
    setBusy(true);
    setMessage('');
    const result = await checkout();
    if (!result.ok) setMessage(result.error);
    else await refresh();
    setBusy(false);
  }

  return (
    <div className="overlay" style={{ zIndex: 2000 }} role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="sub-gate-title" aria-describedby="sub-gate-desc"
        style={{ maxWidth: 440, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(139,92,246,0.14)', color: '#8B5CF6', display: 'grid', placeItems: 'center' }}>
          <Lock size={22} />
        </div>
        <h2 id="sub-gate-title" style={{ margin: 0, fontSize: 20 }}>Your free trial has ended</h2>
        <p id="sub-gate-desc" style={{ margin: 0, fontSize: 14, lineHeight: 1.6, opacity: 0.8 }}>
          {admin
            ? 'Subscribe to TaskFlow Pro to keep using your workspace. Your tasks, files and chats are safe and come back as soon as payment succeeds.'
            : 'Your workspace needs a Pro subscription to continue. Please ask your workspace admin to subscribe. Everything is safe and comes back once they do.'}
        </p>
        {lastNote && <p role="status" style={{ margin: 0, fontSize: 13, color: '#f59e0b' }}>{lastNote}</p>}
        {message && <p role="alert" style={{ margin: 0, fontSize: 13, color: '#ef4444' }}>{message}</p>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
          {admin && (
            <button ref={buttonRef} type="button" className="btn btn-primary" onClick={pay} disabled={busy}>
              {busy ? 'Starting payment…' : 'Subscribe to Pro'}
            </button>
          )}
          <button ref={admin ? undefined : buttonRef} type="button" className="btn btn-ghost" onClick={() => refresh()}>I have paid, check again</button>
          <button type="button" className="btn btn-ghost" onClick={() => signOut()}>Sign out</button>
        </div>
      </div>
    </div>
  );
}
