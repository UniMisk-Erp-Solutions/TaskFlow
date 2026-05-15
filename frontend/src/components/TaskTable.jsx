import React, { useState } from 'react';
import { Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import StatusBadge, { PriorityBadge } from './StatusBadge';
import { isOverdue } from './OverdueBadge';

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatAssignees(task, profileById) {
  if (!profileById) return null;
  const ids = task.assignee_ids?.length
    ? task.assignee_ids
    : task.assignee_id
      ? [task.assignee_id]
      : [];
  if (!ids.length) return '—';
  return ids.map((id) => profileById[id] || id.slice(0, 8)).join(', ');
}

function Th({ label, sortKey, sort, onSort }) {
  const active = sort.key === sortKey;
  return (
    <th style={{ padding: '9px 14px', textAlign: 'left', cursor: sortKey ? 'pointer' : 'default', userSelect: 'none' }}
      onClick={() => sortKey && onSort(sortKey)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: active ? 'var(--tf-text)' : 'var(--tf-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {label}
        {sortKey && (active
          ? (sort.dir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)
          : <ChevronDown size={10} style={{ opacity: 0.3 }} />)}
      </div>
    </th>
  );
}

const STATUSES = ['pending', 'in_progress', 'submitted', 'completed', 'changes_requested', 'blocked'];

const STATUS_LABELS = {
  pending: 'Pending',
  in_progress: 'In Progress',
  submitted: 'Submitted',
  completed: 'Completed',
  changes_requested: 'Changes requested',
  blocked: 'Blocked',
};

export default function TaskTable({ tasks, onDelete, onUpdateStatus, profileById, onOpenTask }) {
  const [sort, setSort]         = useState({ key: 'created_at', dir: 'desc' });
  const [deletingId, setDelId]  = useState(null);

  function handleSort(key) {
    setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }));
  }

  const sorted = [...tasks].sort((a, b) => {
    const av = a[sort.key] ?? '', bv = b[sort.key] ?? '';
    if (av < bv) return sort.dir === 'asc' ? -1 : 1;
    if (av > bv) return sort.dir === 'asc' ? 1 : -1;
    return 0;
  });

  async function handleDelete(id) {
    if (!window.confirm('Delete this task? This cannot be undone.')) return;
    setDelId(id);
    try { await onDelete(id); } finally { setDelId(null); }
  }

  if (!tasks.length) {
    return (
      <div className="empty">
        <div style={{ fontSize: 15, color: 'var(--tf-subhead)' }}>No tasks found</div>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ background: 'var(--tf-pearl)' }}>
          <tr style={{ borderBottom: '1px solid var(--tf-border)' }}>
            <Th label="Title"    sortKey="title"    sort={sort} onSort={handleSort} />
            {profileById && <Th label="Project" sortKey="project_name" sort={sort} onSort={handleSort} />}
            {profileById && <Th label="Assignees" sortKey={null} sort={sort} onSort={handleSort} />}
            <Th label="Priority" sortKey="priority" sort={sort} onSort={handleSort} />
            <Th label="Status"   sortKey="status"   sort={sort} onSort={handleSort} />
            <Th label="Due"      sortKey="due_date" sort={sort} onSort={handleSort} />
            <Th label=""         sortKey={null}     sort={sort} onSort={handleSort} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((task) => {
            const overdue = isOverdue(task.due_date, task.status);
            return (
              <tr key={task.id}
                style={{ borderBottom: '1px solid var(--color-divider-soft)', transition: 'background 80ms ease' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--tf-pearl)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}>

                <td
                  style={{ padding: '11px 14px', maxWidth: 300, cursor: onOpenTask ? 'pointer' : 'default' }}
                  onClick={() => onOpenTask?.(task)}
                  title={onOpenTask ? 'View details' : undefined}
                >
                  <div style={{ fontWeight: 600, color: 'var(--tf-text)', fontSize: 15, marginBottom: task.description ? 2 : 0 }}>
                    {task.title}
                  </div>
                  {task.description && (
                    <div style={{ fontSize: 13, color: 'var(--tf-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260 }}>
                      {task.description}
                    </div>
                  )}
                </td>

                {profileById && (
                  <td style={{ padding: '11px 14px', fontSize: 13, color: 'var(--tf-muted)', maxWidth: 120 }}>
                    {task.project_name || '—'}
                  </td>
                )}
                {profileById && (
                  <td style={{ padding: '11px 14px', fontSize: 13, color: 'var(--tf-muted)', maxWidth: 140 }}>
                    {formatAssignees(task, profileById)}
                  </td>
                )}

                <td style={{ padding: '11px 14px' }}>
                  <PriorityBadge priority={task.priority} />
                </td>

                <td style={{ padding: '11px 14px' }}>
                  <select
                    className="tf-select-inline"
                    value={task.status}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onUpdateStatus(task.id, e.target.value)}
                    style={{ width: 140 }}
                  >
                    {(STATUSES.includes(task.status) ? STATUSES : [task.status, ...STATUSES]).map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s] || s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      </option>
                    ))}
                  </select>
                </td>

                <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                  <span style={{ fontSize: 14, color: overdue ? 'var(--status-danger)' : 'var(--tf-muted)' }}>
                    {fmt(task.due_date)}
                  </span>
                  {overdue && <div style={{ fontSize: 11, color: 'var(--status-danger)', marginTop: 2, fontWeight: 600 }}>Overdue</div>}
                </td>

                <td style={{ padding: '11px 14px' }}>
                  <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(task.id); }} disabled={deletingId === task.id}
                    style={{
                      background: 'none', border: '1px solid transparent', borderRadius: 4,
                      cursor: 'pointer',
                      padding: '8px',
                      color: 'var(--tf-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      transition: 'all 100ms ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--status-danger)';
                      e.currentTarget.style.borderColor = 'rgba(196,30,58,0.25)';
                      e.currentTarget.style.background = 'var(--status-danger-bg)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--tf-muted)';
                      e.currentTarget.style.borderColor = 'transparent';
                      e.currentTarget.style.background = 'none';
                    }}>
                    {deletingId === task.id ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <Trash2 size={13} />}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
