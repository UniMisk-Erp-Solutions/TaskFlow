import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import api from '../api';
import MultiEmployeeSelect from './MultiEmployeeSelect';
import ProjectSelect from './ProjectSelect';
import StatusBadge, { PriorityBadge } from './StatusBadge';

function assigneeNames(task, profileById) {
  const ids = task.assignee_ids?.length
    ? task.assignee_ids
    : task.assignee_id
      ? [task.assignee_id]
      : [];
  if (!ids.length) return '—';
  return ids.map((id) => profileById[id] || id.slice(0, 8)).join(', ');
}

function fmtDue(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function userCanEditTask(record, profileId, isAdmin) {
  if (isAdmin || !profileId || !record) return isAdmin;
  if (record.assignee_id === profileId) return true;
  const ids = record.assignee_ids || [];
  return ids.includes(profileId);
}

export default function TaskDetailModal({
  open,
  task,
  isAdmin = false,
  profile = null,
  projects = [],
  profileById = {},
  onClose,
  updateTask,
  onNavigateTask,
  onAddSubtask,
}) {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState({
    title: '',
    description: '',
    priority: 'medium',
    due_date: '',
    project_id: '',
    assignee_ids: [],
  });

  useEffect(() => {
    if (!open || !task?.id) {
      setRecord(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .get(`/tasks/${task.id}`)
      .then(({ data }) => {
        if (cancelled) return;
        setRecord(data);
        setDraft({
          title: data.title || '',
          description: data.description ?? '',
          priority: data.priority || 'medium',
          due_date: data.due_date || '',
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
        setRecord(task);
        setDraft({
          title: task.title || '',
          description: task.description ?? '',
          priority: task.priority || 'medium',
          due_date: task.due_date || '',
          project_id: task.project_id || '',
          assignee_ids: task.assignee_ids?.length
            ? [...task.assignee_ids]
            : task.assignee_id
              ? [task.assignee_id]
              : [],
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, task?.id]);

  if (!open || !task?.id) return null;

  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  const canEdit = userCanEditTask(record, profile?.id, isAdmin) && !!updateTask;

  async function handleSave(e) {
    e.preventDefault();
    if (!draft.title.trim()) {
      setError('Title is required');
      return;
    }
    if (!draft.assignee_ids?.length) {
      setError('Select at least one assignee');
      return;
    }
    if (!updateTask) return;
    setSaving(true);
    setError('');
    try {
      await updateTask(task.id, {
        title: draft.title.trim(),
        description: draft.description,
        priority: draft.priority,
        due_date: draft.due_date || null,
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

  const subtasks = record?.subtasks || [];

  return (
    <div className="overlay" role="presentation">
      <div className="modal" style={{ maxWidth: 520, width: '100%' }} role="dialog" aria-modal="true">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Task</h2>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tf-muted)', display: 'flex', padding: 4 }}>
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
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--tf-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>Title</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--tf-text)', lineHeight: 1.4 }}>{record.title}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--tf-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>Description</div>
              <div style={{ fontSize: 13, color: 'var(--tf-muted)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{record.description || '—'}</div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', borderTop: '1px solid var(--tf-border)', paddingTop: 14 }}>
              <StatusBadge status={record.status} />
              <PriorityBadge priority={record.priority} />
              <span style={{ fontSize: 12, color: 'var(--tf-muted)' }}>Due {fmtDue(record.due_date)}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--tf-muted)' }}>
              <span style={{ color: 'var(--tf-muted)' }}>Project · </span>
              {record.project_name || '—'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--tf-muted)' }}>
              <span style={{ color: 'var(--tf-muted)' }}>Assignees · </span>
              {assigneeNames(record, profileById)}
            </div>
            {subtasks.length > 0 && (
              <div style={{ borderTop: '1px solid var(--tf-border)', paddingTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tf-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Subtasks</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--tf-text)' }}>
                  {subtasks.map((s) => (
                    <li key={s.id} style={{ marginBottom: 6 }}>
                      {onNavigateTask ? (
                        <button type="button" className="btn btn-ghost btn-sm" style={{ padding: 0, height: 'auto', fontSize: 13 }} onClick={() => onNavigateTask(s)}>
                          {s.title}
                        </button>
                      ) : (
                        s.title
                      )}
                      <span style={{ color: 'var(--tf-muted)', marginLeft: 8 }}>{s.status}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p style={{ fontSize: 11, color: 'var(--tf-subhead)', margin: '8px 0 0' }}>You do not have permission to edit this task.</p>
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
                <label className="form-label">Due date</label>
                <input className="input input-date" type="date" value={draft.due_date} onChange={(e) => set('due_date', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Project</label>
              <ProjectSelect projects={projects} value={draft.project_id} onChange={(v) => set('project_id', v || '')} />
            </div>
            <div className="form-group">
              <label className="form-label">Assignees</label>
              <MultiEmployeeSelect value={draft.assignee_ids} onChange={(ids) => set('assignee_ids', ids)} />
            </div>

            {subtasks.length > 0 && (
              <div style={{ border: '1px solid var(--tf-border)', borderRadius: 11, padding: 12, background: 'var(--tf-pearl)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tf-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Subtasks</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                  {subtasks.map((s) => (
                    <li key={s.id} style={{ marginBottom: 6 }}>
                      {onNavigateTask ? (
                        <button type="button" className="btn btn-ghost btn-sm" style={{ padding: 0, height: 'auto', fontSize: 13 }} onClick={() => onNavigateTask(s)}>
                          {s.title}
                        </button>
                      ) : (
                        s.title
                      )}
                      <span style={{ color: 'var(--tf-muted)', marginLeft: 8 }}>{s.status}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {onAddSubtask && (
              <div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => onAddSubtask(record.id)}>
                  + Add subtask
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
