import React, { useState } from 'react';
import { Calendar } from 'lucide-react';
import StatusBadge, { PriorityBadge } from './StatusBadge';
import { isOverdue } from './OverdueBadge';

/**
 * Status sets are intentionally split:
 *
 *   • Employees: can move work between pending → in_progress, mark it
 *     blocked, or push it to admin via "submitted" (i.e. Submit for review).
 *     They cannot mark `completed` themselves or set `changes_requested`;
 *     those are admin transitions only.
 *
 *   • Admin: full transition set, including completed / changes_requested.
 *
 * If the task is already in an admin-only status (e.g. completed) we still
 * surface that label in the dropdown so the row is not blank — but we lock
 * the control so an employee cannot move it back unilaterally; the
 * Detail modal's "Request changes" / "Reopen" flow is the right path.
 */
const EMPLOYEE_STATUSES = ['pending', 'in_progress', 'submitted', 'blocked'];

const STATUS_LABELS = {
  pending: 'Pending',
  in_progress: 'In Progress',
  submitted: 'Submitted for review',
  blocked: 'Blocked',
  completed: 'Completed',
  changes_requested: 'Changes requested',
};

function labelFor(status) {
  if (STATUS_LABELS[status]) return STATUS_LABELS[status];
  return String(status || '').replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmt(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function TaskCard({ task, onUpdateStatus, onSubmit, onOpenDetail }) {
  const [updating, setUpdating] = useState(false);
  const overdue = isOverdue(task.due_date, task.status);

  async function handleStatus(e) {
    const next = e.target.value;
    setUpdating(true);
    try {
      // "submitted" goes through the dedicated /submit endpoint so the
      // history timeline records a proper "submitted" event and the
      // employee never trips the admin guard on PATCH /tasks/:id.
      if (next === 'submitted' && onSubmit) {
        await onSubmit(task.id, '');
      } else {
        await onUpdateStatus(task.id, next);
      }
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div
      role={onOpenDetail ? 'button' : undefined}
      tabIndex={onOpenDetail ? 0 : undefined}
      onKeyDown={(e) => {
        if (!onOpenDetail) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenDetail();
        }
      }}
      onClick={(e) => {
        if (!onOpenDetail) return;
        if (e.target.closest('select')) return;
        onOpenDetail();
      }}
      style={{
        background: 'var(--tf-panel)',
        border: `1px solid ${overdue ? 'rgba(196,30,58,0.35)' : 'var(--tf-border)'}`,
        borderRadius: 18,
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        cursor: onOpenDetail ? 'pointer' : 'default',
        outline: 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--tf-text)', lineHeight: 1.35, letterSpacing: '-0.015em' }}>{task.title}</div>
          {task.project_name && (
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tf-muted)', marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Project · {task.project_name}
            </div>
          )}
          {task.description && (
            <div style={{ fontSize: 14, color: 'var(--tf-muted)', marginTop: 6, lineHeight: 1.47 }}>{task.description}</div>
          )}
        </div>
        <PriorityBadge priority={task.priority} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <StatusBadge status={task.status} />
        {task.due_date && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              color: overdue ? 'var(--status-danger)' : 'var(--tf-muted)',
            }}
          >
            <Calendar size={14} strokeWidth={2} />
            {overdue && <span style={{ fontWeight: 600 }}>Overdue · </span>}
            {fmt(task.due_date)}
          </div>
        )}
      </div>

      <div style={{ borderTop: '1px solid var(--tf-border)', paddingTop: 14 }}>
        {(() => {
          const adminOwnedStatus = task.status === 'completed' || task.status === 'changes_requested';
          const options = EMPLOYEE_STATUSES.includes(task.status)
            ? EMPLOYEE_STATUSES
            : [task.status, ...EMPLOYEE_STATUSES];
          return (
            <select
              className="tf-select-inline"
              value={task.status}
              onChange={handleStatus}
              disabled={updating || adminOwnedStatus}
              title={adminOwnedStatus ? 'Only an admin can change this status' : undefined}
              style={{ width: '100%' }}
            >
              {options.map((s) => (
                <option key={s} value={s}>{labelFor(s)}</option>
              ))}
            </select>
          );
        })()}
      </div>
    </div>
  );
}
