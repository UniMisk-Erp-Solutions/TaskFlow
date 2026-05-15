import React, { useMemo, useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import MultiEmployeeSelect from './MultiEmployeeSelect';
import ProjectSelect from './ProjectSelect';
import ClockTimePicker from './ClockTimePicker';

/**
 * Normalise meeting_time values for conflict comparison. Backend may return
 * "09:00" or "09:00:00"; we compare by HH:MM only.
 */
function hhmm(t) {
  if (!t) return '';
  const m = String(t).match(/^(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : '';
}

function fmtTime12(t) {
  const v = hhmm(t);
  if (!v) return '';
  const [h, m] = v.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

const DEFAULT = {
  title: '',
  description: '',
  assignee_ids: [],
  priority: 'medium',
  meeting_date: '',
  meeting_time: '',
  project_id: '',
};

export default function MeetingForm({
  onSubmit,
  onClose,
  projects = [],
  defaultProjectId = '',
  parentMeetingId = '',
  initialAssigneeIds = [],
  existingMeetings = [],
}) {
  const [form, setForm] = useState({
    ...DEFAULT,
    project_id: defaultProjectId || '',
    assignee_ids: initialAssigneeIds?.length ? [...initialAssigneeIds] : [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm((ff) => ({ ...ff, [k]: v }));

  // Detect schedule clash: an already-scheduled meeting on the same date+time
  // that shares any assignee with the one we're about to create. Ignores
  // cancelled meetings.
  const conflict = useMemo(() => {
    if (!form.meeting_date || !form.meeting_time) return null;
    const myAssignees = new Set(form.assignee_ids || []);
    const targetTime = hhmm(form.meeting_time);
    for (const m of existingMeetings) {
      if (!m || !m.meeting_date || !m.meeting_time) continue;
      if (m.status === 'cancelled') continue;
      if (m.meeting_date !== form.meeting_date) continue;
      if (hhmm(m.meeting_time) !== targetTime) continue;
      if (myAssignees.size > 0) {
        const others = new Set([
          ...(m.assignee_ids || []),
          ...(m.assignee_id ? [m.assignee_id] : []),
        ]);
        const overlap = [...myAssignees].some((id) => others.has(id));
        if (!overlap) continue;
      }
      return m;
    }
    return null;
  }, [form.meeting_date, form.meeting_time, form.assignee_ids, existingMeetings]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('Title is required');
      return;
    }
    if (!form.assignee_ids?.length) {
      setError('Select at least one participant');
      return;
    }
    if (conflict) {
      setError(`Meeting already booked at this time: “${conflict.title}”. Change the date, time, or participants to continue.`);
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onSubmit({
        ...form,
        title: form.title.trim(),
        meeting_date: form.meeting_date || null,
        meeting_time: form.meeting_date ? (form.meeting_time || null) : null,
        project_id: form.project_id || null,
        assignee_ids: form.assignee_ids,
        parent_meeting_id: parentMeetingId || null,
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="overlay" role="presentation">
      <div className="modal" role="dialog" aria-modal="true">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2>{parentMeetingId ? 'New sub-meeting' : 'New Meeting'}</h2>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink-muted-48)', display: 'flex', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {parentMeetingId && (
            <div style={{ fontSize: 13, color: 'var(--tf-muted)', lineHeight: 1.5 }}>
              This meeting will nest under the selected parent meeting.
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Title</label>
            <input className="input" placeholder="e.g. Sprint planning" value={form.title} onChange={(e) => set('title', e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="input" placeholder="Optional details..." rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Priority</label>
            <select className="select" value={form.priority} onChange={(e) => set('priority', e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          {/* Meeting Date — own full-width row, always visible */}
          <div className="form-group tf-date-field">
            <label className="form-label">Meeting Date (optional)</label>
            <input
              className="input input-date"
              type="date"
              value={form.meeting_date}
              onChange={(e) => {
                const v = e.target.value;
                setForm((ff) => ({ ...ff, meeting_date: v, meeting_time: v ? ff.meeting_time : '' }));
              }}
            />
          </div>

          {/* Meeting Time — own full-width row, always visible (clock face popover) */}
          <div className="form-group">
            <label className="form-label">Meeting Time (optional)</label>
            <ClockTimePicker
              value={form.meeting_time}
              onChange={(v) => set('meeting_time', v)}
              disabled={!form.meeting_date}
              placeholder={form.meeting_date ? 'Pick a time' : 'Pick a date first'}
            />
          </div>

          {conflict && (
            <div
              role="alert"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid rgba(221,91,0,0.30)',
                background: 'var(--status-warning-bg)',
                color: 'var(--status-warning)',
                fontSize: 13,
                lineHeight: 1.45,
              }}
            >
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>Meeting already booked</div>
                <div style={{ color: 'var(--tf-text)', marginTop: 2 }}>
                  “{conflict.title}” is already scheduled at {fmtTime12(conflict.meeting_time)} on this date with at least one of the selected participants.
                </div>
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Project (optional)</label>
            <ProjectSelect projects={projects} value={form.project_id} onChange={(v) => set('project_id', v || '')} />
          </div>

          <div className="form-group">
            <label className="form-label">Participants</label>
            <MultiEmployeeSelect value={form.assignee_ids} onChange={(ids) => set('assignee_ids', ids)} />
          </div>

          {error && <div className="form-error">{error}</div>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Create Meeting'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
