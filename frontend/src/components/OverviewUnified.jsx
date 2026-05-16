import React, { useMemo, useState } from 'react';
import { Trash2, ChevronUp, ChevronDown, Check, XCircle, RotateCcw } from 'lucide-react';
import { PriorityBadge } from './StatusBadge';
import { formatDate, formatTime12 } from '../lib/dateFormat';
import StatusSelect from './StatusSelect';

function RowIconBtn({ children, title, accent, accentBg, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      style={{
        background: 'none',
        border: '1px solid transparent',
        borderRadius: 6,
        cursor: disabled ? 'default' : 'pointer',
        padding: '6px',
        color: 'var(--tf-muted)',
        display: 'flex',
        alignItems: 'center',
        transition: 'all 100ms ease',
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.color = accent;
        e.currentTarget.style.borderColor = accent;
        e.currentTarget.style.background = accentBg;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = 'var(--tf-muted)';
        e.currentTarget.style.borderColor = 'transparent';
        e.currentTarget.style.background = 'none';
      }}
    >
      {children}
    </button>
  );
}

const fmt = formatDate;
const fmtTime = (t) => formatTime12(t);

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
          fontWeight: 600,
          color: active ? 'var(--tf-text)' : 'var(--tf-muted)',
          letterSpacing: '0.06em',
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
  onApproveTask,
  onRequestChangesTask,
  onReopenTask,
  onApproveMeeting,
  onRequestChangesMeeting,
  onReopenMeeting,
  limit = 40,
  hideDeleteColumn = false,
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
    if ((kind === 'task' && !onDeleteTask) || (kind === 'meeting' && !onDeleteMeeting)) return;
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
        <div style={{ fontSize: 15, color: 'var(--tf-subhead)' }}>No tasks or meetings match your filters.</div>
      </div>
    );
  }

  const showDelete = !hideDeleteColumn && (onDeleteTask || onDeleteMeeting);

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ background: 'var(--tf-pearl)' }}>
          <tr style={{ borderBottom: '1px solid var(--tf-border)' }}>
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
              style={{ borderBottom: '1px solid var(--color-divider-soft)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--tf-pearl)';
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
                    color: row.kind === 'task' ? 'var(--color-primary)' : 'var(--status-success)',
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
                <div style={{ fontWeight: 600, color: 'var(--tf-text)', fontSize: 15 }}>{row.title}</div>
                {row.description && (
                  <div
                    style={{
                      fontSize: 13,
                      color: 'var(--tf-muted)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {row.description}
                  </div>
                )}
              </td>
              <td style={{ padding: '11px 14px', fontSize: 14, color: 'var(--tf-muted)' }}>{row.project_name || '—'}</td>
              <td style={{ padding: '11px 14px', fontSize: 13, color: 'var(--tf-muted)', maxWidth: 160 }}>
                {assigneeLabel(row, profileById)}
              </td>
              <td style={{ padding: '11px 14px' }}>
                <PriorityBadge priority={row.priority} />
              </td>
              <td style={{ padding: '11px 14px' }}>
                {row.kind === 'task' ? (
                  <StatusSelect
                    kind="task"
                    value={row.status}
                    onChange={(s) => onUpdateTaskStatus?.(row.id, s)}
                    disabled={!onUpdateTaskStatus}
                  />
                ) : (
                  <StatusSelect
                    kind="meeting"
                    value={row.status}
                    onChange={(s) => onUpdateMeetingStatus?.(row.id, s)}
                    disabled={!onUpdateMeetingStatus}
                  />
                )}
              </td>
              <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                {row.kind === 'task' ? (
                  <span style={{ fontSize: 13, color: row.overdue ? 'var(--status-danger)' : 'var(--tf-muted)' }}>
                    {fmt(row.due_date)}
                    {row.overdue && (
                      <div style={{ fontSize: 11, color: 'var(--status-danger)', marginTop: 2, fontWeight: 600 }}>Overdue</div>
                    )}
                  </span>
                ) : (
                  <span style={{ fontSize: 13, color: row.overdue ? 'var(--status-danger)' : 'var(--tf-muted)' }}>
                    {fmt(row.meeting_date)}
                    <div style={{ fontSize: 12, color: 'var(--tf-muted)', marginTop: 2 }}>{fmtTime(row.meeting_time)}</div>
                    {row.overdue && (
                      <div style={{ fontSize: 11, color: 'var(--status-danger)', marginTop: 2, fontWeight: 600 }}>Overdue</div>
                    )}
                  </span>
                )}
              </td>
              <td style={{ padding: '11px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                  {row.status === 'submitted' && (row.kind === 'task' ? onApproveTask : onApproveMeeting) && (
                    <RowIconBtn
                      title="Approve"
                      accent="var(--status-success)"
                      accentBg="var(--status-success-bg)"
                      onClick={(e) => {
                        e.stopPropagation();
                        const full = row.kind === 'task' ? tasks.find((t) => t.id === row.id) : meetings.find((m) => m.id === row.id);
                        if (row.kind === 'task') onApproveTask?.(full || row);
                        else onApproveMeeting?.(full || row);
                      }}
                    >
                      <Check size={14} />
                    </RowIconBtn>
                  )}
                  {row.status === 'submitted' && (row.kind === 'task' ? onRequestChangesTask : onRequestChangesMeeting) && (
                    <RowIconBtn
                      title="Request changes"
                      accent="var(--status-warning)"
                      accentBg="var(--status-warning-bg)"
                      onClick={(e) => {
                        e.stopPropagation();
                        const full = row.kind === 'task' ? tasks.find((t) => t.id === row.id) : meetings.find((m) => m.id === row.id);
                        if (row.kind === 'task') onRequestChangesTask?.(full || row);
                        else onRequestChangesMeeting?.(full || row);
                      }}
                    >
                      <XCircle size={14} />
                    </RowIconBtn>
                  )}
                  {(row.status === 'completed' || row.status === 'changes_requested') && (row.kind === 'task' ? onReopenTask : onReopenMeeting) && (
                    <RowIconBtn
                      title="Reopen"
                      accent="var(--color-primary)"
                      accentBg="var(--status-info-bg)"
                      onClick={(e) => {
                        e.stopPropagation();
                        const full = row.kind === 'task' ? tasks.find((t) => t.id === row.id) : meetings.find((m) => m.id === row.id);
                        if (row.kind === 'task') onReopenTask?.(full || row);
                        else onReopenMeeting?.(full || row);
                      }}
                    >
                      <RotateCcw size={14} />
                    </RowIconBtn>
                  )}
                  {showDelete && (
                    <RowIconBtn
                      title="Delete"
                      accent="var(--status-danger)"
                      accentBg="var(--status-danger-bg)"
                      disabled={deletingId === `${row.kind}:${row.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(row.kind, row.id);
                      }}
                    >
                      {deletingId === `${row.kind}:${row.id}` ? (
                        <span className="spinner" style={{ width: 12, height: 12 }} />
                      ) : (
                        <Trash2 size={13} />
                      )}
                    </RowIconBtn>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
