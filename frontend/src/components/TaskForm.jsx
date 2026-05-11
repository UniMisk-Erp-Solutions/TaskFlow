import React, { useState } from 'react';
import { X } from 'lucide-react';
import MultiEmployeeSelect from './MultiEmployeeSelect';
import ProjectSelect from './ProjectSelect';

const DEFAULT = { title: '', description: '', assignee_ids: [], priority: 'medium', due_date: '', project_id: '' };

export default function TaskForm({ onSubmit, onClose, projects = [] }) {
  const [form,    setForm]    = useState(DEFAULT);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required'); return; }
    setLoading(true); setError('');
    try {
      await onSubmit({
        ...form,
        title: form.title.trim(),
        project_id: form.project_id || null,
        assignee_ids: form.assignee_ids,
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2>New Task</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', display: 'flex', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Title</label>
            <input className="input" placeholder="e.g. Prepare Q3 report" value={form.title} onChange={(e) => set('title', e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="input" placeholder="Optional details…" rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
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
            <div className="form-group">
              <label className="form-label">Due Date</label>
              <input className="input" type="date" style={{ colorScheme: 'dark' }} value={form.due_date} onChange={(e) => set('due_date', e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Project (optional)</label>
            <ProjectSelect projects={projects} value={form.project_id} onChange={(v) => set('project_id', v || '')} />
          </div>

          <div className="form-group">
            <label className="form-label">Assign to employees (multi-select)</label>
            <MultiEmployeeSelect value={form.assignee_ids} onChange={(ids) => set('assignee_ids', ids)} />
          </div>

          {error && <div className="form-error">{error}</div>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
