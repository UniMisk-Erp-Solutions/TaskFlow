import React, { useState } from 'react';
import { Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import StatusBadge, { PriorityBadge } from './StatusBadge';
import { isOverdue } from './OverdueBadge';

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function Th({ label, sortKey, sort, onSort }) {
  const active = sort.key === sortKey;
  return (
    <th style={{ padding: '9px 14px', textAlign: 'left', cursor: sortKey ? 'pointer' : 'default', userSelect: 'none' }}
      onClick={() => sortKey && onSort(sortKey)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, color: active ? '#999' : '#444', letterSpacing: '0.3px', textTransform: 'uppercase' }}>
        {label}
        {sortKey && (active
          ? (sort.dir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)
          : <ChevronDown size={10} style={{ opacity: 0.3 }} />)}
      </div>
    </th>
  );
}

const STATUSES = ['pending', 'in_progress', 'completed', 'blocked'];

export default function TaskTable({ tasks, onDelete, onUpdateStatus }) {
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
        <div style={{ fontSize: 13, color: '#444' }}>No tasks found</div>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ background: '#0c0c0c' }}>
          <tr style={{ borderBottom: '1px solid #1e1e1e' }}>
            <Th label="Title"    sortKey="title"    sort={sort} onSort={handleSort} />
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
                style={{ borderBottom: '1px solid #191919', transition: 'background 80ms ease' }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#0f0f0f'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>

                <td style={{ padding: '11px 14px', maxWidth: 300 }}>
                  <div style={{ fontWeight: 500, color: '#ddd', fontSize: 13, marginBottom: task.description ? 2 : 0 }}>
                    {task.title}
                  </div>
                  {task.description && (
                    <div style={{ fontSize: 11, color: '#444', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260 }}>
                      {task.description}
                    </div>
                  )}
                </td>

                <td style={{ padding: '11px 14px' }}>
                  <PriorityBadge priority={task.priority} />
                </td>

                <td style={{ padding: '11px 14px' }}>
                  <select
                    value={task.status}
                    onChange={(e) => onUpdateStatus(task.id, e.target.value)}
                    style={{
                      background: '#111', border: '1px solid #222', color: '#bbb',
                      borderRadius: 4, padding: '4px 8px', fontSize: 12,
                      fontFamily: 'inherit', cursor: 'pointer', outline: 'none',
                      width: 128,
                    }}>
                    {STATUSES.map((s) => (
                      <option key={s} value={s} style={{ background: '#191919' }}>
                        {s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </option>
                    ))}
                  </select>
                </td>

                <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                  <span style={{ fontSize: 12, color: overdue ? '#f87171' : '#555' }}>
                    {fmt(task.due_date)}
                  </span>
                  {overdue && <div style={{ fontSize: 10, color: '#f87171', marginTop: 2, fontWeight: 500 }}>Overdue</div>}
                </td>

                <td style={{ padding: '11px 14px' }}>
                  <button onClick={() => handleDelete(task.id)} disabled={deletingId === task.id}
                    style={{
                      background: 'none', border: '1px solid transparent', borderRadius: 4,
                      cursor: 'pointer', padding: '5px 6px', color: '#444',
                      display: 'flex', alignItems: 'center', transition: 'all 100ms ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color='#f87171'; e.currentTarget.style.borderColor='rgba(248,113,113,0.2)'; e.currentTarget.style.background='rgba(248,113,113,0.05)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color='#444'; e.currentTarget.style.borderColor='transparent'; e.currentTarget.style.background='none'; }}>
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
