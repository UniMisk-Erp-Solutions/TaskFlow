import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import api from '../api';
import MultiEmployeeSelect from './MultiEmployeeSelect';
import ProjectSelect from './ProjectSelect';
import { PriorityBadge } from './StatusBadge';

function assigneeNames(meeting, profileById) {
  const ids = meeting.assignee_ids?.length
    ? meeting.assignee_ids
    : meeting.assignee_id
      ? [meeting.assignee_id]
      : [];
  if (!ids.length) return '—';
  return ids.map((id) => profileById[id] || id.slice(0, 8)).join(', ');
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtTime(t) {
  if (!t) return '—';
  const [h, m] = String(t).split(':');
  const date = new Date();
  date.setHours(Number(h || 0), Number(m || 0), 0, 0);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function toDateInputValue(v) {
  if (v == null || v === '') return '';
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}

/** `<input type="time">` expects HH:mm in practice (API may send HH:mm:ss). */
function toTimeInputValue(v) {
  if (v == null || v === '') return '';
  const s = String(v).trim();
  if (/^\d{2}:\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{2}:\d{2})/);
  return m ? m[1] : '';
}

function statusLabel(s) {
  if (!s) return '—';
  return s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function userCanEditMeeting(record, profileId, isAdmin) {
  if (isAdmin || !profileId || !record) return isAdmin;
  if (record.assignee_id === profileId) return true;
  const ids = record.assignee_ids || [];
  return ids.includes(profileId);
}

export default function MeetingDetailModal({
  open,
  meeting,
  isAdmin = false,
  profile = null,
  projects = [],
  profileById = {},
  onClose,
  updateMeeting,
  onNavigateMeeting,
  onAddSubmeeting,
}) {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState({
    title: '',
    description: '',
    priority: 'medium',
    meeting_date: '',
    meeting_time: '',
    project_id: '',
    assignee_ids: [],
  });

  useEffect(() => {
    if (!open || !meeting?.id) {
      setRecord(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .get(`/meetings/${meeting.id}`)
      .then(({ data }) => {
        if (cancelled) return;
        setRecord(data);
        setDraft({
          title: data.title || '',
          description: data.description ?? '',
          priority: data.priority || 'medium',
          meeting_date: toDateInputValue(data.meeting_date),
          meeting_time: toTimeInputValue(data.meeting_time),
          project_id: data.project_id || '',
          assignee_ids: data.assignee_ids?.length
            ? [...data.assignee_ids]
            : data.assignee_id
              ? [data.assignee_id]
              : [],
        });
      })
      .catch(() => {
        if (cancelled) return;
        setRecord(meeting);
        setDraft({
          title: meeting.title || '',
          description: meeting.description ?? '',
          priority: meeting.priority || 'medium',
          meeting_date: toDateInputValue(meeting.meeting_date),
          meeting_time: toTimeInputValue(meeting.meeting_time),
          project_id: meeting.project_id || '',
          assignee_ids: meeting.assignee_ids?.length
            ? [...meeting.assignee_ids]
            : meeting.assignee_id
              ? [meeting.assignee_id]
              : [],
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, meeting?.id]);

  if (!open || !meeting?.id) return null;

  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  const canEdit = userCanEditMeeting(record, profile?.id, isAdmin) && !!updateMeeting;

  async function handleSave(e) {
    e.preventDefault();
    if (!draft.title.trim()) {
      setError('Title is required');
      return;
    }
    if (!draft.meeting_date || !draft.meeting_time) {
      setError('Meeting date and time are required');
      return;
    }
    if (!draft.assignee_ids?.length) {
      setError('Select at least one participant');
      return;
    }
    if (!updateMeeting) return;
    setSaving(true);
    setError('');
    try {
      await updateMeeting(meeting.id, {
        title: draft.title.trim(),
        description: draft.description,
        priority: draft.priority,
        meeting_date: draft.meeting_date,
        meeting_time: draft.meeting_time,
        project_id: draft.project_id || null,
        assignee_ids: draft.assignee_ids,
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setSaving(false);
    }
  }

  const submeetings = record?.submeetings || [];

  return (
    <div className="overlay" role="presentation">
      <div className="modal" style={{ maxWidth: 520, width: '100%' }} role="dialog" aria-modal="true">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Meeting</h2>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink-muted-48)', display: 'flex', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        {loading && (
          <div style={{ padding: 32, display: 'flex', justifyContent: 'center' }}>
            <span className="spinner" />
          </div>
        )}

        {!loading && record && !canEdit && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-ink-muted-48)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>Title</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-ink)', lineHeight: 1.4 }}>{record.title}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-ink-muted-48)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>Description</div>
              <div style={{ fontSize: 13, color: 'var(--tf-muted)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{record.description || '—'}</div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', borderTop: '1px solid var(--tf-border)', paddingTop: 14 }}>
              <span style={{ fontSize: 12, color: 'var(--tf-muted)' }}>{statusLabel(record.status)}</span>
              <PriorityBadge priority={record.priority} />
              <span style={{ fontSize: 12, color: 'var(--tf-muted)' }}>
                {fmtDate(record.meeting_date)} · {fmtTime(record.meeting_time)}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--tf-muted)' }}>
              <span style={{ color: 'var(--color-ink-muted-48)' }}>Project · </span>
              {record.project_name || '—'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--tf-muted)' }}>
              <span style={{ color: 'var(--color-ink-muted-48)' }}>Assignees · </span>
              {assigneeNames(record, profileById)}
            </div>
            {submeetings.length > 0 && (
              <div style={{ borderTop: '1px solid var(--tf-border)', paddingTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tf-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Sub-meetings</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                  {submeetings.map((s) => (
                    <li key={s.id} style={{ marginBottom: 6 }}>
                      {onNavigateMeeting ? (
                        <button type="button" className="btn btn-ghost btn-sm" style={{ padding: 0, height: 'auto', fontSize: 13 }} onClick={() => onNavigateMeeting(s)}>
                          {s.title}
                        </button>
                      ) : (
                        s.title
                      )}
                      <span style={{ color: 'var(--tf-muted)', marginLeft: 8 }}>{statusLabel(s.status)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p style={{ fontSize: 11, color: 'var(--tf-muted)', margin: '8px 0 0' }}>You do not have permission to edit this meeting.</p>
          </div>
        )}

        {!loading && record && canEdit && (
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Title</label>
              <input className="input" value={draft.title} onChange={(e) => set('title', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="input" rows={4} value={draft.description} onChange={(e) => set('description', e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select className="select" value={draft.priority} onChange={(e) => set('priority', e.target.value)}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="form-group tf-date-field">
                <label className="form-label">Meeting date</label>
                <input className="input input-date" type="date" value={draft.meeting_date} onChange={(e) => set('meeting_date', e.target.value)} />
              </div>
            </div>
            <div className="form-group tf-date-field">
              <label className="form-label">Meeting time</label>
              <input className="input input-time" type="time" value={draft.meeting_time} onChange={(e) => set('meeting_time', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Project</label>
              <ProjectSelect projects={projects} value={draft.project_id} onChange={(v) => set('project_id', v || '')} />
            </div>
            <div className="form-group">
              <label className="form-label">Assignees</label>
              <MultiEmployeeSelect value={draft.assignee_ids} onChange={(ids) => set('assignee_ids', ids)} />
            </div>

            {submeetings.length > 0 && (
              <div style={{ border: '1px solid var(--tf-border)', borderRadius: 11, padding: 12, background: 'var(--tf-pearl)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tf-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Sub-meetings</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                  {submeetings.map((s) => (
                    <li key={s.id} style={{ marginBottom: 6 }}>
                      {onNavigateMeeting ? (
                        <button type="button" className="btn btn-ghost btn-sm" style={{ padding: 0, height: 'auto', fontSize: 13 }} onClick={() => onNavigateMeeting(s)}>
                          {s.title}
                        </button>
                      ) : (
                        s.title
                      )}
                      <span style={{ color: 'var(--tf-muted)', marginLeft: 8 }}>{statusLabel(s.status)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {onAddSubmeeting && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--tf-muted)', lineHeight: 1.45 }}>
                  Open a meeting here, then use <strong style={{ fontWeight: 600 }}>Add sub-meeting</strong> for follow-ups nested under it.
                </p>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ alignSelf: 'flex-start' }}
                  onClick={() =>
                    onAddSubmeeting(record.id, {
                      projectId: record.project_id || '',
                    })
                  }
                >
                  + Add sub-meeting
                </button>
              </div>
            )}

            {error && <div className="form-error">{error}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Save'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
