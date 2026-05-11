import React, { useMemo, useState } from 'react';
import { Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { PriorityBadge } from './StatusBadge';

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const date = new Date();
  date.setHours(Number(h || 0), Number(m || 0), 0, 0);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function assigneeLabel(item, profileById) {
  const ids = item.assignee_ids?.length
    ? item.assignee_ids
    : item.assignee_id
      ? [item.assignee_id]
      : [];
  if (!ids.length) return '—';
  return ids.map((id) => profileById[id] || id.slice(0, 8)).join(', ');
}

function Th({ label, sortKey, sort, onSort }) {
  const active = sort.key === sortKey;
  return (
    <th
      style={{ padding: '9px 14px', textAlign: 'left', cursor: sortKey ? 'pointer' : 'default', userSelect: 'none' }}
      onClick={() => sortKey && onSort(sortKey)}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 11,
          fontWeight: 500,
          color: active ? '#999' : '#444',
          letterSpacing: '0.3px',
          textTransform: 'uppercase',
        }}
      >
        {label}
        {sortKey &&
          (active ? (
            sort.dir === 'asc' ? (
              <ChevronUp size={10} />
            ) : (
              <ChevronDown size={10} />
            )
          ) : (
            <ChevronDown size={10} style={{ opacity: 0.3 }} />
          ))}
      </div>
    </th>
  );
}

export default function OverviewUnified({
  tasks = [],
  meetings = [],
  loading,
  meetingsLoading,
  profileById = {},
  onDeleteTask,
  onUpdateTaskStatus,
  onDeleteMeeting,
  onUpdateMeetingStatus,
  onOpenTaskDetail,
  onOpenMeetingDetail,
  limit = 40,
}) {
  const [sort, setSort] = useState({ key: 'sort_date', dir: 'desc' });
  const [deletingId, setDeletingId] = useState(null);

  const rows = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const tRows = tasks.map((t) => ({
      kind: 'task',
      id: t.id,
      title: t.title,
      description: t.description,
      priority: t.priority,
      status: t.status,
      project_name: t.project_name,
      assignee_ids: t.assignee_ids,
      assignee_id: t.assignee_id,
      due_date: t.due_date,
      meeting_date: null,
      meeting_time: null,
      sort_date: t.due_date || t.created_at || '',
      overdue: !!(t.due_date && t.due_date < today && t.status !== 'completed'),
    }));
    const mRows = meetings.map((m) => ({
      kind: 'meeting',
      id: m.id,
      title: m.title,
      description: m.description,
      priority: m.priority,
      status: m.status,
      project_name: m.project_name,
      assignee_ids: m.assignee_ids,
      assignee_id: m.assignee_id,
      due_date: null,
      meeting_date: m.meeting_date,
      meeting_time: m.meeting_time,
      sort_date: m.meeting_date || m.created_at || '',
      overdue: !!(m.meeting_date && m.meeting_date < today && m.status === 'scheduled'),
    }));
    return [...tRows, ...mRows];
  }, [tasks, meetings]);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sort.key] ?? '';
      const bv = b[sort.key] ?? '';
      if (av < bv) return sort.dir === 'asc' ? -1 : 1;
      if (av > bv) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });
    return copy.slice(0, limit);
  }, [rows, sort, limit]);

  function handleSort(key) {
    setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }));
  }

  function openRowDetail(row) {
    if (row.kind === 'task') {
      const full = tasks.find((t) => t.id === row.id);
      onOpenTaskDetail?.(full || row);
    } else {
      const full = meetings.find((m) => m.id === row.id);
      onOpenMeetingDetail?.(full || row);
    }
  }

  async function handleDelete(kind, id) {
    if (!window.confirm(`Delete this ${kind}?`)) return;
    setDeletingId(`${kind}:${id}`);
    try {
      if (kind === 'task') await onDeleteTask(id);
      else await onDeleteMeeting(id);
    } finally {
      setDeletingId(null);
    }
  }

  if (loading || meetingsLoading) {
    return (
      <div style={{ padding: 48, display: 'flex', justifyContent: 'center' }}>
        <span className="spinner" />
      </div>
    );
  }

  if (!sorted.length) {
    return (
      <div className="empty">
        <div style={{ fontSize: 13, color: '#444' }}>No tasks or meetings match your filters.</div>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ background: '#0c0c0c' }}>
          <tr style={{ borderBottom: '1px solid #1e1e1e' }}>
            <Th label="Type" sortKey="kind" sort={sort} onSort={handleSort} />
            <Th label="Title" sortKey="title" sort={sort} onSort={handleSort} />
            <Th label="Project" sortKey="project_name" sort={sort} onSort={handleSort} />
            <Th label="Assignees" sortKey={null} sort={sort} onSort={handleSort} />
            <Th label="Priority" sortKey="priority" sort={sort} onSort={handleSort} />
            <Th label="Status" sortKey="status" sort={sort} onSort={handleSort} />
            <Th label="Date" sortKey="sort_date" sort={sort} onSort={handleSort} />
            <Th label="" sortKey={null} sort={sort} onSort={handleSort} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={`${row.kind}-${row.id}`}
              style={{ borderBottom: '1px solid #191919' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#0f0f0f';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <td style={{ padding: '11px 14px' }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    color: row.kind === 'task' ? '#818cf8' : '#34d399',
                    letterSpacing: '0.5px',
                  }}
                >
                  {row.kind}
                </span>
              </td>
              <td
                style={{
                  padding: '11px 14px',
                  maxWidth: 220,
                  cursor: onOpenTaskDetail || onOpenMeetingDetail ? 'pointer' : 'default',
                }}
                onClick={() => (onOpenTaskDetail || onOpenMeetingDetail) && openRowDetail(row)}
                title={onOpenTaskDetail || onOpenMeetingDetail ? 'View details' : undefined}
              >
                <div style={{ fontWeight: 500, color: '#ddd', fontSize: 13 }}>{row.title}</div>
                {row.description && (
                  <div
                    style={{
                      fontSize: 11,
                      color: '#444',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {row.description}
                  </div>
                )}
              </td>
              <td style={{ padding: '11px 14px', fontSize: 12, color: '#666' }}>{row.project_name || '—'}</td>
              <td style={{ padding: '11px 14px', fontSize: 11, color: '#888', maxWidth: 160 }}>
                {assigneeLabel(row, profileById)}
              </td>
              <td style={{ padding: '11px 14px' }}>
                <PriorityBadge priority={row.priority} />
              </td>
              <td style={{ padding: '11px 14px' }}>
                {row.kind === 'task' ? (
                  <select
                    value={row.status}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onUpdateTaskStatus(row.id, e.target.value)}
                    style={{
                      background: '#111',
                      border: '1px solid #222',
                      color: '#bbb',
                      borderRadius: 4,
                      padding: '4px 8px',
                      fontSize: 12,
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      width: 120,
                    }}
                  >
                    {['pending', 'in_progress', 'completed', 'blocked'].map((s) => (
                      <option key={s} value={s}>
                        {s.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={row.status}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onUpdateMeetingStatus(row.id, e.target.value)}
                    style={{
                      background: '#111',
                      border: '1px solid #222',
                      color: '#bbb',
                      borderRadius: 4,
                      padding: '4px 8px',
                      fontSize: 12,
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      width: 120,
                    }}
                  >
                    {['scheduled', 'completed', 'cancelled'].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                )}
              </td>
              <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                {row.kind === 'task' ? (
                  <span style={{ fontSize: 12, color: row.overdue ? '#f87171' : '#555' }}>
                    {fmt(row.due_date)}
                    {row.overdue && (
                      <div style={{ fontSize: 10, color: '#f87171', marginTop: 2 }}>Overdue</div>
                    )}
                  </span>
                ) : (
                  <span style={{ fontSize: 12, color: row.overdue ? '#f87171' : '#555' }}>
                    {fmt(row.meeting_date)}
                    <div style={{ fontSize: 11, color: '#777', marginTop: 2 }}>{fmtTime(row.meeting_time)}</div>
                    {row.overdue && (
                      <div style={{ fontSize: 10, color: '#f87171', marginTop: 2 }}>Overdue</div>
                    )}
                  </span>
                )}
              </td>
              <td style={{ padding: '11px 14px' }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(row.kind, row.id);
                  }}
                  disabled={deletingId === `${row.kind}:${row.id}`}
                  style={{
                    background: 'none',
                    border: '1px solid transparent',
                    borderRadius: 4,
                    cursor: 'pointer',
                    padding: '5px 6px',
                    color: '#444',
                  }}
                >
                  {deletingId === `${row.kind}:${row.id}` ? (
                    <span className="spinner" style={{ width: 12, height: 12 }} />
                  ) : (
                    <Trash2 size={13} />
                  )}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
