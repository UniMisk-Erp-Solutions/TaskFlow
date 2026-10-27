import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarOff, Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useAuth } from '../AuthContext';
import api from '../api';
import SelectMenu from './SelectMenu';

const TYPE_OPTIONS = [
  { value: 'sick', label: 'Sick' },
  { value: 'exam', label: 'Exam' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'trip', label: 'Trip' },
  { value: 'half day', label: 'Half day' },
  { value: 'late coming', label: 'Late coming' },
  { value: 'custom', label: 'Custom…' },
];

// Half day / late coming are always a single day, and read better without the word "leave" after them.
const SINGLE_DAY_TYPES = ['half day', 'late coming'];

const STATUS = {
  pending: { label: 'Pending', color: '#b45309', bg: 'rgba(245, 158, 11, 0.16)' },
  approved: { label: 'Approved', color: '#15803d', bg: 'rgba(34, 197, 94, 0.16)' },
  rejected: { label: 'Rejected', color: '#b91c1c', bg: 'rgba(239, 68, 68, 0.16)' },
};

const fieldStyle = {
  width: '100%',
  minWidth: 0,
  border: '1px solid var(--tf-border)',
  borderRadius: 10,
  background: 'var(--tf-page)',
  color: 'var(--tf-text)',
  padding: '10px 12px',
  font: 'inherit',
  fontSize: 14,
  outlineColor: 'var(--color-primary)',
};

const labelStyle = { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--tf-muted)', minWidth: 0 };

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Dates are plain calendar days (no time zone), so format them from their parts rather than through Date's UTC parsing.
export function formatLeaveDate(iso) {
  const [y, m, d] = String(iso || '').split('-').map(Number);
  if (!y || !m || !d) return iso || '';
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function leaveTypeLabel(request) {
  if (request.is_custom) return request.leave_type;
  return request.leave_type.charAt(0).toUpperCase() + request.leave_type.slice(1);
}

function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.pending;
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, color: s.color, background: s.bg, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  );
}

const emptyForm = () => ({ leave_type: 'sick', custom_type: '', duration: 'single', start_date: today(), end_date: today(), reason: '' });

function LeaveForm({ name, initial, onCancel, onSaved }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = { ...form, end_date: form.duration === 'single' ? form.start_date : form.end_date };
      if (initial.id) await api.patch(`/leaves/${initial.id}`, payload);
      else await api.post('/leaves', payload);
      onSaved();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Could not save the leave request.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="tf-leave-form" style={{ background: 'var(--tf-panel)', border: '1px solid var(--tf-border)', borderRadius: 14, padding: 16, display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <strong style={{ fontSize: 15, color: 'var(--tf-text)' }}>{initial.id ? 'Edit leave request' : 'New leave request'}</strong>
        <button type="button" onClick={onCancel} aria-label="Close form" style={{ background: 'none', border: 0, color: 'var(--tf-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 4 }}><X size={18} /></button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <label style={labelStyle}>
          Name
          <input value={name} readOnly style={{ ...fieldStyle, opacity: 0.8 }} aria-readonly="true" />
        </label>
        <div style={labelStyle}>
          <span>Leave type</span>
          <SelectMenu
            value={form.leave_type}
            ariaLabel="Leave type"
            options={TYPE_OPTIONS}
            onChange={(value) => setForm((f) => (SINGLE_DAY_TYPES.includes(value) ? { ...f, leave_type: value, duration: 'single', end_date: f.start_date } : { ...f, leave_type: value }))}
          />
        </div>
        {form.leave_type === 'custom' && (
          <label style={labelStyle}>
            Custom type
            <input value={form.custom_type} onChange={(e) => set('custom_type', e.target.value)} maxLength={60} placeholder="e.g. Wedding, Interview" required style={fieldStyle} />
          </label>
        )}
      </div>

      <div style={labelStyle}>
        Duration
        <div role="group" aria-label="Duration" style={{ display: 'inline-flex', border: '1px solid var(--tf-border)', borderRadius: 10, overflow: 'hidden', alignSelf: 'flex-start', maxWidth: '100%' }}>
          {[['single', 'One day'], ['multi', 'Multiple days']].map(([value, text]) => (
            <button
              key={value}
              type="button"
              aria-pressed={form.duration === value}
              disabled={value === 'multi' && SINGLE_DAY_TYPES.includes(form.leave_type)}
              title={value === 'multi' && SINGLE_DAY_TYPES.includes(form.leave_type) ? 'Half day and late coming are for a single day' : undefined}
              onClick={() => set('duration', value)}
              style={{ border: 0, padding: '9px 16px', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: form.duration === value ? 'var(--color-primary)' : 'var(--tf-page)', color: form.duration === value ? 'var(--color-on-primary)' : 'var(--tf-text)' }}
            >
              {text}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <label style={labelStyle}>
          From
          <input type="date" value={form.start_date} required onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value, end_date: f.duration === 'single' || f.end_date < e.target.value ? e.target.value : f.end_date }))} style={fieldStyle} />
        </label>
        <label style={labelStyle}>
          To
          <input type="date" value={form.duration === 'single' ? form.start_date : form.end_date} min={form.start_date} required disabled={form.duration === 'single'} onChange={(e) => set('end_date', e.target.value)} style={{ ...fieldStyle, opacity: form.duration === 'single' ? 0.6 : 1 }} />
        </label>
      </div>

      <label style={labelStyle}>
        Reason (optional)
        <textarea value={form.reason} onChange={(e) => set('reason', e.target.value)} maxLength={1000} rows={3} style={{ ...fieldStyle, resize: 'vertical' }} />
      </label>

      <div style={labelStyle}>
        Status
        <div><StatusBadge status="pending" /> <span style={{ fontWeight: 400, marginLeft: 6 }}>An admin approves or rejects it.</span></div>
      </div>

      {error && <div role="alert" style={{ color: '#b91c1c', fontSize: 13 }}>{error}</div>}

      <div className="tf-leave-form-actions" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel} style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid var(--tf-border)', background: 'transparent', color: 'var(--tf-text)', cursor: 'pointer', font: 'inherit', fontSize: 14 }}>Cancel</button>
        <button type="submit" disabled={saving} style={{ padding: '9px 18px', borderRadius: 10, border: 0, background: 'var(--color-primary)', color: 'var(--color-on-primary)', cursor: saving ? 'default' : 'pointer', font: 'inherit', fontSize: 14, fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Saving…' : initial.id ? 'Save changes' : 'Submit request'}
        </button>
      </div>
    </form>
  );
}

function IconAction({ icon: Icon, label, onClick, tone, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 9, border: '1px solid var(--tf-border)', background: 'var(--tf-page)', color: tone || 'var(--tf-text)', cursor: disabled ? 'default' : 'pointer', font: 'inherit', fontSize: 13, fontWeight: 600, opacity: disabled ? 0.6 : 1 }}
    >
      <Icon size={14} /> {label}
    </button>
  );
}

export default function LeavePortal({ isAdmin = false }) {
  const { profile } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState(null); // null = closed, otherwise the initial form values
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/leaves');
      setRows(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Could not load leave requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => rows.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {}), [rows]);
  const visible = filter === 'all' ? rows : rows.filter((r) => r.status === filter);
  const myName = profile?.full_name || profile?.email || '';

  const act = async (id, run, done) => {
    setBusyId(id);
    setNotice('');
    try {
      await run();
      if (done) setNotice(done);
      await load();
    } catch (err) {
      setNotice(err?.response?.data?.error || err?.message || 'That did not work. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const decide = (r, status) => act(r.id, () => api.patch(`/leaves/${r.id}`, { status }), `${r.employee_name}'s leave ${status}.`);
  const cancel = (r) => {
    if (!window.confirm(isAdmin && r.status !== 'pending' ? 'Delete this leave record?' : 'Cancel this leave request?')) return;
    act(r.id, () => api.delete(`/leaves/${r.id}`), 'Leave request removed.');
  };
  const edit = (r) => setForm({ id: r.id, leave_type: r.is_custom ? 'custom' : r.leave_type, custom_type: r.is_custom ? r.leave_type : '', duration: r.duration, start_date: r.start_date, end_date: r.end_date, reason: r.reason || '' });

  const filters = [['all', 'All', rows.length], ['pending', 'Pending', counts.pending || 0], ['approved', 'Approved', counts.approved || 0], ['rejected', 'Rejected', counts.rejected || 0]];

  return (
    <div className="tf-leave" style={{ display: 'grid', gap: 16, maxWidth: 980 }}>
      <div className="tf-leave-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <p style={{ margin: 0, color: 'var(--tf-muted)', fontSize: 14, minWidth: 0 }}>
          {isAdmin ? 'Review your team’s leave requests, or request leave yourself.' : 'Request time off and track whether it has been approved.'}
        </p>
        {!form && (
          <button type="button" onClick={() => setForm(emptyForm())} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, border: 0, background: 'var(--color-primary)', color: 'var(--color-on-primary)', cursor: 'pointer', font: 'inherit', fontSize: 14, fontWeight: 600 }}>
            <Plus size={16} /> Request leave
          </button>
        )}
      </div>

      {form && <LeaveForm name={myName} initial={form} onCancel={() => setForm(null)} onSaved={() => { setForm(null); setNotice(form.id ? 'Leave request updated.' : 'Leave request submitted — waiting for approval.'); load(); }} />}

      {notice && <div role="status" style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--tf-pearl)', color: 'var(--tf-text)', fontSize: 13 }}>{notice}</div>}

      <div role="tablist" aria-label="Filter by status" className="tf-leave-tabs" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {filters.map(([value, text, n]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={filter === value}
            onClick={() => setFilter(value)}
            style={{ padding: '6px 14px', borderRadius: 999, border: '1px solid var(--tf-border)', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: filter === value ? 'var(--color-primary)' : 'var(--tf-panel)', color: filter === value ? 'var(--color-on-primary)' : 'var(--tf-text)' }}
          >
            {text} <span style={{ opacity: 0.75 }}>{n}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="spinner" style={{ width: 22, height: 22 }} />
      ) : error ? (
        <div role="alert" style={{ color: '#b91c1c', fontSize: 14 }}>{error}</div>
      ) : visible.length === 0 ? (
        <div style={{ display: 'grid', placeItems: 'center', gap: 8, padding: '40px 16px', border: '1px dashed var(--tf-border)', borderRadius: 14, color: 'var(--tf-muted)', textAlign: 'center' }}>
          <CalendarOff size={28} />
          <div style={{ fontSize: 14 }}>{rows.length ? 'No requests with this status.' : isAdmin ? 'No leave requests yet.' : 'You have not requested any leave yet.'}</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {visible.map((r) => {
            const mine = r.user_id === profile?.id;
            const pending = r.status === 'pending';
            const busy = busyId === r.id;
            return (
              <article key={r.id} className="tf-leave-card" style={{ background: 'var(--tf-panel)', border: '1px solid var(--tf-border)', borderRadius: 14, padding: '14px 16px', display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: 'var(--tf-text)', overflowWrap: 'anywhere' }}>{r.employee_name}</div>
                    <div style={{ fontSize: 13, color: 'var(--tf-muted)', marginTop: 2, overflowWrap: 'anywhere' }}>
                      {leaveTypeLabel(r)}{SINGLE_DAY_TYPES.includes(r.leave_type) ? '' : ' leave'} · {r.duration === 'single' ? 'One day' : `${r.days} days`}
                    </div>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 13, color: 'var(--tf-text)' }}>
                  <span><span style={{ color: 'var(--tf-muted)' }}>From </span>{formatLeaveDate(r.start_date)}</span>
                  <span><span style={{ color: 'var(--tf-muted)' }}>To </span>{formatLeaveDate(r.end_date)}</span>
                </div>
                {r.reason && <div style={{ fontSize: 13, color: 'var(--tf-subhead)', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{r.reason}</div>}
                {!pending && r.reviewed_by_name && (
                  <div style={{ fontSize: 12, color: 'var(--tf-muted)' }}>
                    {STATUS[r.status].label} by {r.reviewed_by_name}{r.review_note ? ` — “${r.review_note}”` : ''}
                  </div>
                )}
                {((isAdmin && pending) || (mine && pending) || isAdmin) && (
                  <div className="tf-leave-card-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {isAdmin && pending && <IconAction icon={Check} label="Approve" tone="#15803d" disabled={busy} onClick={() => decide(r, 'approved')} />}
                    {isAdmin && pending && <IconAction icon={X} label="Reject" tone="#b91c1c" disabled={busy} onClick={() => decide(r, 'rejected')} />}
                    {isAdmin && !pending && <IconAction icon={Pencil} label="Back to pending" disabled={busy} onClick={() => decide(r, 'pending')} />}
                    {mine && pending && <IconAction icon={Pencil} label="Edit" disabled={busy} onClick={() => edit(r)} />}
                    {(mine ? pending : isAdmin) && <IconAction icon={Trash2} label={pending ? 'Cancel request' : 'Delete'} disabled={busy} onClick={() => cancel(r)} />}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
