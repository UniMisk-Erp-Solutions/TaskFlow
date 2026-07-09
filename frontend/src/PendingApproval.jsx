import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, XCircle, Zap, RefreshCw } from 'lucide-react';
import { useAuth } from './AuthContext';

/**
 * Shown while a "join organization" request is pending an admin's decision.
 * Once the admin approves, the profile gets an org_id and `/auth/me` reports
 * status "active" — the user is dropped straight into the app.
 */
export default function PendingApproval() {
  const { profile, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const rejected = profile?.status === 'rejected';

  async function check() {
    setBusy(true);
    try {
      await refreshProfile();
    } finally { setBusy(false); }
  }

  // Poll every 20s so an approved user gets in without touching anything.
  useEffect(() => {
    if (rejected) return undefined;
    const t = setInterval(() => { refreshProfile(); }, 20000);
    return () => clearInterval(t);
  }, [rejected, refreshProfile]);

  useEffect(() => {
    if (profile?.status === 'active') navigate('/app', { replace: true });
  }, [profile?.status, navigate]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--tf-page)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Zap size={20} color="var(--color-primary)" />
        <span style={{ fontSize: 19, fontWeight: 600, color: 'var(--tf-text)' }}>TaskFlow</span>
      </div>

      <div style={{ width: '100%', maxWidth: 460, background: 'var(--tf-panel)', border: '1px solid var(--tf-border)', borderRadius: 16, padding: 28, textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14, color: rejected ? '#dc2626' : 'var(--color-primary)' }}>
          {rejected ? <XCircle size={40} strokeWidth={1.6} /> : <Clock size={40} strokeWidth={1.6} />}
        </div>

        <h1 style={{ fontSize: 21, fontWeight: 600, color: 'var(--tf-text)', margin: 0 }}>
          {rejected ? 'Request declined' : 'Waiting for approval'}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--tf-muted)', marginTop: 8, lineHeight: 1.55 }}>
          {rejected
            ? 'An administrator declined your request to join. Please contact them if you think this was a mistake.'
            : 'Your request to join has been sent to the organization’s admins. You’ll get a WhatsApp message once it’s approved — this page updates automatically.'}
        </p>

        {!rejected && (
          <button className="btn btn-primary" disabled={busy} onClick={check} style={{ marginTop: 20, justifyContent: 'center', width: '100%', gap: 8 }}>
            {busy ? <span className="spinner" style={{ width: 15, height: 15 }} /> : <RefreshCw size={15} />}
            {busy ? 'Checking…' : 'Check again'}
          </button>
        )}

        <button className="btn btn-ghost btn-sm" onClick={() => signOut()} style={{ marginTop: 12 }}>
          Sign out
        </button>
      </div>
    </div>
  );
}
