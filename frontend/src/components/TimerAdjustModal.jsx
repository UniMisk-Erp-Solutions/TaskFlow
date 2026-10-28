import React, { useMemo, useState } from 'react';
import { Clock3, X } from 'lucide-react';
import { elapsedSecondsForSession, formatElapsedSeconds } from '../lib/taskTimer';

const pad = (n) => String(n).padStart(2, '0');
// <input type="datetime-local"> wants local time without a zone.
function toLocalInput(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Lets the person set when their latest timer session on a task really ended
 * (e.g. they forgot to press Pause). The previous end time is kept for admins.
 */
export default function TimerAdjustModal({ task, session, onClose, onSave }) {
  const startMs = Date.parse(session.started_at);
  const nowMs = Date.now();
  const currentEndMs = session.ended_at ? Date.parse(session.ended_at) : nowMs;
  const [value, setValue] = useState(toLocalInput(currentEndMs));
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const newEndMs = Date.parse(value);
  const problem = useMemo(() => {
    if (!Number.isFinite(newEndMs)) return 'Choose a valid time.';
    if (newEndMs < startMs) return 'The end time cannot be before the timer started.';
    if (newEndMs > Date.now() + 60000) return 'The end time cannot be in the future.';
    return '';
  }, [newEndMs, startMs]);
  const newSeconds = Number.isFinite(newEndMs) && !problem ? Math.floor((newEndMs - startMs) / 1000) : null;

  const shiftEarlier = (minutes) => setValue(toLocalInput(Math.max(startMs, Date.parse(value || '') - minutes * 60000 || currentEndMs - minutes * 60000)));

  async function submit(event) {
    event.preventDefault();
    if (problem) return;
    setSaving(true);
    setError('');
    try {
      await onSave({ session_id: session.id, ended_at: new Date(newEndMs).toISOString(), reason: reason.trim() || undefined });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Could not adjust the timer.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="modal" role="dialog" aria-modal="true" aria-label="Adjust timer" onSubmit={submit} style={{ maxWidth: 440 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>Adjust timer</h2>
          <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--tf-muted)' }}>
          Forgot to stop the timer on <strong style={{ color: 'var(--tf-text)' }}>{task.title}</strong>? Set the time you actually finished.
          Your admin can see that it was adjusted.
        </p>
        <div style={{ fontSize: 13, marginBottom: 10 }}>
          Started: <strong>{new Date(startMs).toLocaleString()}</strong><br />
          {session.ended_at ? 'Currently ended' : 'Still running'}: <strong>{new Date(currentEndMs).toLocaleString()}</strong>
          {' '}<span style={{ color: 'var(--tf-muted)' }}>({formatElapsedSeconds(elapsedSecondsForSession(session, nowMs))})</span>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="timer-adjust-end">Work ended at</label>
          <input id="timer-adjust-end" className="input" type="datetime-local" value={value} min={toLocalInput(startMs)} max={toLocalInput(nowMs)} onChange={(e) => setValue(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '6px 0 10px' }}>
          {[15, 30, 60].map((m) => (
            <button key={m} type="button" className="btn btn-ghost btn-sm" onClick={() => shiftEarlier(m)}>−{m < 60 ? `${m} min` : '1 h'}</button>
          ))}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setValue(toLocalInput(Date.now()))}>Now</button>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="timer-adjust-reason">Reason (optional)</label>
          <input id="timer-adjust-reason" className="input" maxLength={300} placeholder="e.g. forgot to pause before lunch" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <div style={{ fontSize: 13, margin: '8px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Clock3 size={14} aria-hidden="true" />
          {problem ? <span style={{ color: 'var(--status-danger)' }}>{problem}</span> : <span>New time on this session: <strong>{formatElapsedSeconds(newSeconds)}</strong></span>}
        </div>
        {error && <div role="alert" style={{ color: 'var(--status-danger)', fontSize: 13, marginBottom: 8 }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving || Boolean(problem)}>{saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Save time'}</button>
        </div>
      </form>
    </div>
  );
}
