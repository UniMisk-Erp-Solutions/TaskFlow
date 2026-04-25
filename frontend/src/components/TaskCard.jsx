import React, { useState } from 'react';
import { Calendar } from 'lucide-react';
import StatusBadge, { PriorityBadge } from './StatusBadge';
import { isOverdue } from './OverdueBadge';

const STATUSES = ['pending', 'in_progress', 'completed', 'blocked'];

function fmt(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function TaskCard({ task, onUpdateStatus }) {
  const [updating, setUpdating] = useState(false);
  const overdue = isOverdue(task.due_date, task.status);

  async function handleStatus(e) {
    setUpdating(true);
    try { await onUpdateStatus(task.id, e.target.value); }
    finally { setUpdating(false); }
  }

  return (
    <div style={{
      background: '#111',
      border: `1px solid ${overdue ? 'rgba(248,113,113,0.2)' : '#1e1e1e'}`,
      borderRadius: 6, padding: '16px',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      {/* Title + priority */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 500, fontSize: 13, color: '#ddd', lineHeight: 1.4 }}>{task.title}</div>
          {task.description && (
            <div style={{ fontSize: 12, color: '#444', marginTop: 4, lineHeight: 1.5 }}>{task.description}</div>
          )}
        </div>
        <PriorityBadge priority={task.priority} />
      </div>

      {/* Status + due */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <StatusBadge status={task.status} />
        {task.due_date && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: overdue ? '#f87171' : '#444' }}>
            <Calendar size={11} />
            {overdue && <span style={{ fontWeight: 600 }}>Overdue · </span>}
            {fmt(task.due_date)}
          </div>
        )}
      </div>

      <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: 12 }}>
        <select value={task.status} onChange={handleStatus} disabled={updating}
          style={{
            width: '100%', background: '#0e0e0e', border: '1px solid #222',
            color: '#888', borderRadius: 4, padding: '6px 10px', fontSize: 12,
            fontFamily: 'inherit', cursor: 'pointer', outline: 'none',
          }}>
          {STATUSES.map((s) => (
            <option key={s} value={s} style={{ background: '#191919' }}>
              {s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
