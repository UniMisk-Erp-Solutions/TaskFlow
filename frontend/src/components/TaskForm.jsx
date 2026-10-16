import React, { useState } from 'react';
import { X } from 'lucide-react';
import MultiEmployeeSelect from './MultiEmployeeSelect';
import ProjectSelect from './ProjectSelect';
import ClockTimePicker from './ClockTimePicker';
import AttachmentPicker, { uploadStagedAttachments } from './AttachmentPicker';
import { EOD_TIME } from '../lib/dateFormat';

const DEFAULT = {
  title: '',
  description: '',
  assignee_ids: [],
  priority: 'medium',
  due_date: '',
  due_time: '',
  project_id: '',
};

export default function TaskForm({
  onSubmit,
  onClose,
  projects = [],
  defaultProjectId = '',
  parentTaskId = '',
  parentOptions = [],
  initialAssigneeIds = [],
}) {
  const [form, setForm] = useState({
    ...DEFAULT,
    project_id: defaultProjectId || '',
    assignee_ids: initialAssigneeIds?.length ? [...initialAssigneeIds] : [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [files, setFiles] = useState([]);
  const [parentId, setParentId] = useState(parentTaskId || '');
  // Only top-level, still-open tasks can take subtasks (no nesting, matches the API rule).
  const parentChoices = parentOptions.filter((t) => !t.parent_task_id && t.status !== 'completed');

  const set = (k, v) => setForm((ff) => ({ ...ff, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('Title is required');
      return;
    }
    if (!form.assignee_ids?.length) {
      setError('Select at least one assignee');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const created = await onSubmit({
        ...form,
        title: form.title.trim(),
        due_date: form.due_date || null,
        due_time: form.due_date ? (form.due_time || null) : null,
        project_id: form.project_id || null,
        assignee_ids: form.assignee_ids,
        parent_task_id: parentId || null,
      });
      // Upload staged files to the new task (needs its id).
      if (files.length && created?.id) {
        const res = await uploadStagedAttachments('task', created.id, files);
        if (res.failed.length) {
          window.alert(`Task created. ${res.uploaded} file(s) uploaded, ${res.failed.length} failed:\n` +
            res.failed.map((f) => `• ${f.name}: ${f.reason}`).join('\n'));
        }
      }
      onClose();
      return created;
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      return undefined;
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="overlay" role="presentation">
      <div className="modal" role="dialog" aria-modal="true">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2>{parentId ? 'New subtask' : 'New Task'}</h2>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink-muted-48)', display: 'flex', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {parentId && (
            <div style={{ fontSize: 13, color: 'var(--tf-muted)', lineHeight: 1.5 }}>
              This task will be linked under the selected parent task.
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Title</label>
            <input className="input" placeholder="e.g. Prepare Q3 report" value={form.title} onChange={(e) => set('title', e.target.value)} />
          </div>

          {(parentChoices.length > 0 || parentId) && (
            <div className="form-group">
              <label className="form-label" htmlFor="task-parent">Subtask of (optional)</label>
              <select
                id="task-parent"
                className="select"
                value={parentId}
                onChange={(e) => {
                  const next = e.target.value;
                  setParentId(next);
                  const parent = parentChoices.find((t) => t.id === next);
                  if (parent) {
                    setForm((ff) => ({
                      ...ff,
                      project_id: ff.project_id || parent.project_id || '',
                      assignee_ids: ff.assignee_ids?.length ? ff.assignee_ids : (parent.assignee_ids || []),
                    }));
                  }
                }}
              >
                <option value="">Not a subtask — standalone task</option>
                {parentChoices.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                {parentId && !parentChoices.some((t) => t.id === parentId) && <option value={parentId}>Selected parent task</option>}
              </select>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="input" placeholder="Optional details…" rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Priority</label>
            <select className="select" value={form.priority} onChange={(e) => set('priority', e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          {/* Due Date — full-width row, always visible */}
          <div className="form-group tf-date-field">
            <label className="form-label">Due Date (optional)</label>
            <input
              className="input input-date"
              type="date"
              value={form.due_date}
              onChange={(e) => {
                const v = e.target.value;
                setForm((ff) => ({
                  ...ff,
                  due_date: v,
                  // Pick a date → if no time yet, default to end-of-day (6:00 PM).
                  due_time: v ? (ff.due_time || EOD_TIME) : '',
                }));
              }}
            />
          </div>

          {/* Due Time — full-width row, always visible (clock face popover) */}
          <div className="form-group">
            <label className="form-label">Due Time (optional)</label>
            <ClockTimePicker
              value={form.due_time}
              onChange={(v) => set('due_time', v)}
              disabled={!form.due_date}
              placeholder={form.due_date ? 'Pick a time' : 'Pick a date first'}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Project (optional)</label>
            <ProjectSelect projects={projects} value={form.project_id} onChange={(v) => set('project_id', v || '')} />
          </div>

          <div className="form-group">
            <label className="form-label">Assign to</label>
            <MultiEmployeeSelect value={form.assignee_ids} onChange={(ids) => set('assignee_ids', ids)} />
          </div>

          {/* Files: staged now, uploaded right after the task is created. */}
          <AttachmentPicker files={files} onChange={setFiles} />

          {error && <div className="form-error">{error}</div>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
