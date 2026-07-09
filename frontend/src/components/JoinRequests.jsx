import React, { useCallback, useEffect, useState } from 'react';
import { Check, X, RefreshCw, Copy, UserPlus } from 'lucide-react';
import api from '../api';
import { useAuth } from '../AuthContext';

/**
 * Admin panel: people who signed up and entered this organization's 6-digit code.
 * Approving sets their org_id (they can then just log in normally); rejecting
 * leaves them without an org. Both notify the person on WhatsApp.
 * Users the admin creates directly never appear here — they skip approval.
 */
export default function JoinRequests() {
  const { profile } = useAuth();
  const joinCode = profile?.org?.org_uid;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/join-requests');
      setRows(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not load join requests');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function decide(id, action) {
    setBusyId(id);
    try {
      await api.post(`/admin/join-requests/${id}/${action}`);
      await load();
    } catch (err) {
      setError(err?.response?.data?.error || `Could not ${action} the request`);
    } finally { setBusyId(null); }
  }

  const pending = rows.filter((r) => r.status === 'pending');

  return (
    <div style={{ border: '1px solid var(--tf-border)', borderRadius: 6, background: 'var(--tf-panel)', marginBottom: 16, overflow: 'hidden' }}>
      <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--tf-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--tf-muted)', letterSpacing: '0.3px', textTransform: 'uppercase' }}>
            Join requests {pending.length > 0 && `(${pending.length})`}
          </span>
          <div style={{ fontSize: 11, color: 'var(--tf-muted)', marginTop: 2 }}>
            People who signed up using your organization code
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {joinCode && (
            <button
              className="btn btn-ghost btn-sm"
              title="Share this code so teammates can request to join"
              onClick={() => { navigator.clipboard?.writeText(joinCode); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              style={{ gap: 6, fontVariantNumeric: 'tabular-nums' }}
            >
              <Copy size={12} /> Code: <strong style={{ letterSpacing: 2 }}>{joinCode}</strong>{copied && ' ✓'}
            </button>
          )}
          <button className="btn btn-ghost btn-sm btn-icon" onClick={load} disabled={loading}>
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 16px', fontSize: 12, color: 'var(--status-danger)', borderBottom: '1px solid var(--tf-border)' }}>{error}</div>
      )}

      {loading ? (
        <div style={{ padding: 24, display: 'flex', justifyContent: 'center' }}><span className="spinner" /></div>
      ) : pending.length === 0 ? (
        <div style={{ padding: '20px 16px', fontSize: 12, color: 'var(--tf-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <UserPlus size={14} /> No pending requests.
          {joinCode && <> Share code <strong style={{ letterSpacing: 2 }}>{joinCode}</strong> to let people request access.</>}
        </div>
      ) : (
        <div style={{ padding: '8px 16px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pending.map((r) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 12px', border: '1px solid var(--tf-border)', borderRadius: 8, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tf-text)' }}>{r.profile?.full_name || r.profile?.email}</div>
                <div style={{ fontSize: 11, color: 'var(--tf-muted)' }}>
                  {r.profile?.email}{r.profile?.phone ? ` · ${r.profile.phone}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-primary btn-sm" disabled={busyId === r.id} onClick={() => decide(r.id, 'approve')} style={{ gap: 5 }}>
                  {busyId === r.id ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <Check size={13} />} Approve
                </button>
                <button className="btn btn-ghost btn-sm" disabled={busyId === r.id} onClick={() => decide(r.id, 'reject')} style={{ gap: 5 }}>
                  <X size={13} /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
