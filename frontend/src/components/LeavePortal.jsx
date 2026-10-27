import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, CalendarDays, CalendarOff, Check, ChevronLeft, ChevronRight, List, Pencil, Plus, Trash2, X } from 'lucide-react';
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

const pad2 = (n) => String(n).padStart(2, '0');
const isoOf = (y, m, d) => `${y}-${pad2(m + 1)}-${pad2(d)}`;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Month grid: every leave request is drawn on each day it covers, coloured by status. Tap a day to see its requests. */
function LeaveCalendar({ rows, selected, onSelect, showNames }) {
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const todayIso = isoOf(now.getFullYear(), now.getMonth(), now.getDate());
  const firstWeekday = new Date(cursor.y, cursor.m, 1).getDay();
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
  while (cells.length % 7) cells.push(null);

  const shift = (delta) => setCursor((c) => {
    const next = new Date(c.y, c.m + delta, 1);
    return { y: next.getFullYear(), m: next.getMonth() };
  });
  const onDay = (iso) => rows.filter((r) => r.start_date <= iso && iso <= r.end_date);
  const chipLabel = (r) => `${showNames ? `${String(r.employee_name || '').split(' ')[0]} · ` : ''}${leaveTypeLabel(r)}`;

  return (
    <div className="tf-lc">
      <div className="tf-lc-head">
        <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="Previous month" onClick={() => shift(-1)}><ChevronLeft size={16} /></button>
        <strong className="tf-lc-title" aria-live="polite">{MONTHS[cursor.m]} {cursor.y}</strong>
        <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="Next month" onClick={() => shift(1)}><ChevronRight size={16} /></button>
        <button type="button" className="btn btn-ghost btn-sm tf-lc-today" onClick={() => { setCursor({ y: now.getFullYear(), m: now.getMonth() }); onSelect(todayIso); }}>Today</button>
      </div>
      <div className="tf-lc-grid" role="grid" aria-label={`${MONTHS[cursor.m]} ${cursor.y}`}>
        {WEEKDAYS.map((w) => <div key={w} className="tf-lc-dow" role="columnheader">{w}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} className="tf-lc-cell is-empty" role="gridcell" aria-hidden="true" />;
          const iso = isoOf(cursor.y, cursor.m, d);
          const list = onDay(iso);
          return (
            <button
              key={iso}
              type="button"
              role="gridcell"
              className={`tf-lc-cell${iso === todayIso ? ' is-today' : ''}${iso === selected ? ' is-selected' : ''}`}
              aria-label={`${d} ${MONTHS[cursor.m]}${list.length ? `, ${list.length} leave request${list.length === 1 ? '' : 's'}` : ''}`}
              aria-pressed={iso === selected}
              onClick={() => onSelect(iso === selected ? null : iso)}
            >
              <span className="tf-lc-num">{d}</span>
              <span className="tf-lc-chips">
                {list.slice(0, 2).map((r) => (
                  <span key={r.id} className="tf-lc-chip" style={{ color: STATUS[r.status]?.color, background: STATUS[r.status]?.bg }} title={`${r.employee_name} — ${leaveTypeLabel(r)} (${STATUS[r.status]?.label})`}>{chipLabel(r)}</span>
                ))}
                {list.length > 2 && <span className="tf-lc-more">+{list.length - 2} more</span>}
              </span>
              {list.length > 0 && (
                <span className="tf-lc-dots" aria-hidden="true">
                  {list.slice(0, 3).map((r) => <i key={r.id} style={{ background: STATUS[r.status]?.color }} />)}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="tf-lc-legend">
        {Object.entries(STATUS).map(([key, s]) => <span key={key}><i style={{ background: s.color }} /> {s.label}</span>)}
      </div>
    </div>
  );
}

const dayNumber = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000;
const monthKey = (iso) => iso.slice(0, 7);
const monthLabel = (key) => `${MONTHS[+key.slice(5, 7) - 1]} ${key.slice(0, 4)}`;
const allMonthKeysBetween = (fromKey, toKey) => {
  const out = [];
  let y = +fromKey.slice(0, 4);
  let m = +fromKey.slice(5, 7);
  while (`${y}-${pad2(m)}` <= toKey) {
    out.push(`${y}-${pad2(m)}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
};

/** How many days a request counts for: half day = 0.5, late coming = 0 (it is an occurrence, not a day off). */
function leaveDays(r, from, to) {
  if (r.leave_type === 'half day') return 0.5;
  if (r.leave_type === 'late coming') return 0;
  const start = Math.max(dayNumber(r.start_date), from);
  const end = Math.min(dayNumber(r.end_date), to);
  return Math.max(0, end - start + 1);
}

const fmtDays = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Admin / manager view: how much leave each person has taken, filtered by person, type, month and status. */
function LeaveSummary({ rows }) {
  const [person, setPerson] = useState('all');
  const [type, setType] = useState('all');
  const [month, setMonth] = useState('all');
  const [scope, setScope] = useState('approved'); // approved | all

  const people = useMemo(() => {
    const seen = new Map();
    rows.forEach((r) => { if (!seen.has(r.user_id)) seen.set(r.user_id, r.employee_name || 'Unknown'); });
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const typeOptions = useMemo(() => {
    const base = TYPE_OPTIONS.filter((o) => o.value !== 'custom');
    const custom = [...new Set(rows.filter((r) => r.is_custom).map((r) => r.leave_type))].sort();
    return [{ value: 'all', label: 'All types' }, ...base, ...custom.map((c) => ({ value: `custom:${c}`, label: c }))];
  }, [rows]);

  const monthOptions = useMemo(() => {
    const now = new Date();
    const nowKey = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
    const keys = rows.flatMap((r) => [monthKey(r.start_date), monthKey(r.end_date)]).concat(nowKey).sort();
    const list = allMonthKeysBetween(keys[0], keys[keys.length - 1]).reverse();
    return [{ value: 'all', label: 'All time' }, ...list.map((k) => ({ value: k, label: monthLabel(k) }))];
  }, [rows]);

  const { groups, totals } = useMemo(() => {
    const from = month === 'all' ? -Infinity : dayNumber(`${month}-01`);
    const to = month === 'all' ? Infinity : dayNumber(`${month}-${pad2(new Date(+month.slice(0, 4), +month.slice(5, 7), 0).getDate())}`);
    const byUser = new Map();
    rows.forEach((r) => {
      if (scope === 'approved' && r.status !== 'approved') return;
      if (person !== 'all' && r.user_id !== person) return;
      if (type !== 'all' && (type.startsWith('custom:') ? !(r.is_custom && r.leave_type === type.slice(7)) : (r.is_custom || r.leave_type !== type))) return;
      if (dayNumber(r.end_date) < from || dayNumber(r.start_date) > to) return;
      const entry = byUser.get(r.user_id) || { id: r.user_id, name: r.employee_name || 'Unknown', requests: 0, days: 0, types: new Map() };
      const days = leaveDays(r, from, to);
      entry.requests += 1;
      entry.days += days;
      const label = leaveTypeLabel(r);
      const t = entry.types.get(label) || { count: 0, days: 0 };
      t.count += 1;
      t.days += days;
      entry.types.set(label, t);
      byUser.set(r.user_id, entry);
    });
    const list = [...byUser.values()].sort((a, b) => b.days - a.days || b.requests - a.requests || a.name.localeCompare(b.name));
    return { groups: list, totals: { requests: list.reduce((n, g) => n + g.requests, 0), days: list.reduce((n, g) => n + g.days, 0), people: list.length } };
  }, [rows, person, type, month, scope]);

  const personOptions = [{ value: 'all', label: 'Everyone' }, ...people.map(([id, name]) => ({ value: id, label: name }))];
  const scopeOptions = [{ value: 'approved', label: 'Approved only' }, { value: 'all', label: 'All requests' }];

  return (
    <div className="tf-ls">
      <div className="tf-ls-filters">
        <div className="tf-ls-field"><span>Employee</span><SelectMenu value={person} onChange={setPerson} options={personOptions} ariaLabel="Filter by employee" /></div>
        <div className="tf-ls-field"><span>Leave type</span><SelectMenu value={type} onChange={setType} options={typeOptions} ariaLabel="Filter by leave type" /></div>
        <div className="tf-ls-field"><span>Month</span><SelectMenu value={month} onChange={setMonth} options={monthOptions} ariaLabel="Filter by month" /></div>
        <div className="tf-ls-field"><span>Counting</span><SelectMenu value={scope} onChange={setScope} options={scopeOptions} ariaLabel="Which requests to count" /></div>
      </div>

      <div className="tf-ls-tiles">
        <div><b>{totals.requests}</b><span>Requests</span></div>
        <div><b>{fmtDays(totals.days)}</b><span>Days off</span></div>
        <div><b>{totals.people}</b><span>{totals.people === 1 ? 'Employee' : 'Employees'}</span></div>
      </div>

      {groups.length === 0 ? (
        <div style={{ display: 'grid', placeItems: 'center', gap: 8, padding: '32px 16px', border: '1px dashed var(--tf-border)', borderRadius: 14, color: 'var(--tf-muted)', textAlign: 'center' }}>
          <CalendarOff size={26} />
          <div style={{ fontSize: 14 }}>No leave matches these filters.</div>
        </div>
      ) : (
        <div className="tf-ls-list">
          {groups.map((g) => (
            <article key={g.id} className="tf-ls-card">
              <div className="tf-ls-card-head">
                <strong>{g.name}</strong>
                <span>{g.requests} request{g.requests === 1 ? '' : 's'} · {fmtDays(g.days)} day{g.days === 1 ? '' : 's'}</span>
              </div>
              <div className="tf-ls-types">
                {[...g.types.entries()].sort((a, b) => b[1].count - a[1].count).map(([label, t]) => (
                  <span key={label} className="tf-ls-type" title={`${t.count} request${t.count === 1 ? '' : 's'}, ${fmtDays(t.days)} day${t.days === 1 ? '' : 's'}`}>{label} <b>{t.count}</b></span>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
      <div className="tf-ls-note">Half day counts as 0.5 day. Late coming is counted as a request but adds no days off.</div>
    </div>
  );
}

export default function LeavePortal({ isAdmin = false, canSummary = false }) {
  const showSummary = isAdmin || canSummary;
  const { profile } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState(null); // null = closed, otherwise the initial form values
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState('');
  const [view, setView] = useState('list'); // list | calendar
  const [selectedDay, setSelectedDay] = useState(null); // ISO date picked on the calendar

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

  const renderCard = (r) => {
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
  };

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

      <div className="tf-leave-toolbar">
      <div role="tablist" aria-label="Filter by status" className="tf-leave-tabs" style={{ display: view === 'summary' ? 'none' : 'flex', gap: 8, flexWrap: 'wrap' }}>
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
      <div className="tf-leave-views" role="group" aria-label="View">
        <button type="button" aria-pressed={view === 'list'} className={view === 'list' ? 'is-active' : ''} onClick={() => setView('list')}><List size={14} /> List</button>
        <button type="button" aria-pressed={view === 'calendar'} className={view === 'calendar' ? 'is-active' : ''} onClick={() => setView('calendar')}><CalendarDays size={14} /> Calendar</button>
        {showSummary && <button type="button" aria-pressed={view === 'summary'} className={view === 'summary' ? 'is-active' : ''} onClick={() => setView('summary')}><BarChart3 size={14} /> Summary</button>}
      </div>
      </div>

      {loading ? (
        <div className="spinner" style={{ width: 22, height: 22 }} />
      ) : error ? (
        <div role="alert" style={{ color: '#b91c1c', fontSize: 14 }}>{error}</div>
      ) : view === 'summary' && showSummary ? (
        <LeaveSummary rows={rows} />
      ) : view === 'calendar' ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <LeaveCalendar rows={visible} selected={selectedDay} onSelect={setSelectedDay} showNames={isAdmin} />
          {selectedDay && (
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tf-muted)' }}>{formatLeaveDate(selectedDay)}</div>
              {visible.filter((r) => r.start_date <= selectedDay && selectedDay <= r.end_date).map((r) => renderCard(r))}
              {!visible.some((r) => r.start_date <= selectedDay && selectedDay <= r.end_date) && (
                <div style={{ fontSize: 13, color: 'var(--tf-muted)' }}>No leave on this day.</div>
              )}
            </div>
          )}
        </div>
      ) : visible.length === 0 ? (
        <div style={{ display: 'grid', placeItems: 'center', gap: 8, padding: '40px 16px', border: '1px dashed var(--tf-border)', borderRadius: 14, color: 'var(--tf-muted)', textAlign: 'center' }}>
          <CalendarOff size={28} />
          <div style={{ fontSize: 14 }}>{rows.length ? 'No requests with this status.' : isAdmin ? 'No leave requests yet.' : 'You have not requested any leave yet.'}</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {visible.map((r) => renderCard(r))}
        </div>
      )}
    </div>
  );
}
