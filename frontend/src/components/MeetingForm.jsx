import React, { useState } from 'react';
import { X } from 'lucide-react';
import MultiEmployeeSelect from './MultiEmployeeSelect';
import ProjectSelect from './ProjectSelect';

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
}) {
  const [form, setForm] = useState({
    ...DEFAULT,
    project_id: defaultProjectId || '',
    assignee_ids: initialAssigneeIds?.length ? [...initialAssigneeIds] : [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm((ff) => ({ ...ff, [k]: v }));

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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="form-group">
              <label className="form-label">Priority</label>
              <select className="select" value={form.priority} onChange={(e) => set('priority', e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="form-group tf-date-field">
              <label className="form-label">Meeting Date (optional)</label>
              <input className="input input-date" type="date" value={form.meeting_date} onChange={(e) => set('meeting_date', e.target.value)} />
            </div>
          </div>

          {form.meeting_date && (
            <div className="form-group tf-date-field">
              <label className="form-label">Meeting Time (optional)</label>
              <input className="input input-time" type="time" value={form.meeting_time} onChange={(e) => set('meeting_time', e.target.value)} />
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
