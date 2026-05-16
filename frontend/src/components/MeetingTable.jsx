import React, { useState } from 'react';
import { Trash2, ChevronUp, ChevronDown, Check, XCircle, RotateCcw } from 'lucide-react';
import { PriorityBadge } from './StatusBadge';
import MeetingFilesModal from './MeetingFilesModal';
import { formatDate as fmt, formatTime12 } from '../lib/dateFormat';
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

function fmtTime(t) {
  return formatTime12(t) || '-';
}

function formatAssignees(meeting, profileById) {
  if (!profileById) return null;
  const ids = meeting.assignee_ids?.length
    ? meeting.assignee_ids
    : meeting.assignee_id
      ? [meeting.assignee_id]
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

const STATUSES = ['scheduled', 'completed', 'cancelled'];

export default function MeetingTable({
  meetings,
  onDelete,
  onUpdateStatus,
  canDelete = true,
  isAdmin = false,
  profileById,
  onOpenMeeting,
  onApprove,
  onRequestChanges,
  onReopen,
}) {
  const [sort, setSort] = useState({ key: 'created_at', dir: 'desc' });
  const [deletingId, setDelId] = useState(null);
  const [filesFor, setFilesFor] = useState(null);

  function handleSort(key) {
    setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }));
  }

  const sorted = [...meetings].sort((a, b) => {
    const av = a[sort.key] ?? '';
    const bv = b[sort.key] ?? '';
    if (av < bv) return sort.dir === 'asc' ? -1 : 1;
    if (av > bv) return sort.dir === 'asc' ? 1 : -1;
    return 0;
  });

  async function handleDelete(id) {
    if (!window.confirm('Delete this meeting? This cannot be undone.')) return;
    setDelId(id);
    try { await onDelete(id); } finally { setDelId(null); }
  }

  if (!meetings.length) {
    return (
      <div className="empty">
        <div style={{ fontSize: 15, color: 'var(--tf-subhead)' }}>No meetings found</div>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ background: 'var(--tf-pearl)' }}>
          <tr style={{ borderBottom: '1px solid var(--tf-border)' }}>
            <Th label="Title" sortKey="title" sort={sort} onSort={handleSort} />
            {profileById && <Th label="Project" sortKey="project_name" sort={sort} onSort={handleSort} />}
            {profileById && <Th label="Assignees" sortKey={null} sort={sort} onSort={handleSort} />}
            <Th label="Priority" sortKey="priority" sort={sort} onSort={handleSort} />
            <Th label="Status" sortKey="status" sort={sort} onSort={handleSort} />
            <Th label="Meeting Date" sortKey="meeting_date" sort={sort} onSort={handleSort} />
            <Th label="" sortKey={null} sort={sort} onSort={handleSort} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((meeting) => (
            <tr key={meeting.id}
              style={{ borderBottom: '1px solid var(--color-divider-soft)', transition: 'background 80ms ease' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--tf-pearl)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}>

              <td
                style={{ padding: '11px 14px', maxWidth: 300, cursor: onOpenMeeting ? 'pointer' : 'default' }}
                onClick={() => onOpenMeeting?.(meeting)}
                title={onOpenMeeting ? 'View details' : undefined}
              >
                <div style={{ fontWeight: 600, color: 'var(--tf-text)', fontSize: 15, marginBottom: meeting.description ? 2 : 0 }}>
                  {meeting.title}
                </div>
                {meeting.description && (
                  <div style={{ fontSize: 13, color: 'var(--tf-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260 }}>
                    {meeting.description}
                  </div>
                )}
              </td>

              {profileById && (
                <td style={{ padding: '11px 14px', fontSize: 13, color: 'var(--tf-muted)', maxWidth: 120 }}>
                  {meeting.project_name || '—'}
                </td>
              )}
              {profileById && (
                <td style={{ padding: '11px 14px', fontSize: 13, color: 'var(--tf-muted)', maxWidth: 140 }}>
                  {formatAssignees(meeting, profileById)}
                </td>
              )}

              <td style={{ padding: '11px 14px' }}>
                <PriorityBadge priority={meeting.priority} />
              </td>

              <td style={{ padding: '11px 14px' }}>
                <StatusSelect
                  kind="meeting"
                  value={meeting.status}
                  onChange={(s) => onUpdateStatus(meeting.id, s)}
                />
              </td>

              <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: 14, color: 'var(--tf-muted)' }}>
                  {fmt(meeting.meeting_date)}
                </span>
                <div style={{ fontSize: 13, color: 'var(--tf-muted)', marginTop: 2 }}>
                  {fmtTime(meeting.meeting_time)}
                </div>
              </td>

              <td style={{ padding: '11px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                  {meeting.status === 'submitted' && onApprove && (
                    <RowIconBtn
                      title="Approve"
                      accent="var(--status-success)"
                      accentBg="var(--status-success-bg)"
                      onClick={(e) => { e.stopPropagation(); onApprove(meeting); }}
                    >
                      <Check size={14} />
                    </RowIconBtn>
                  )}
                  {meeting.status === 'submitted' && onRequestChanges && (
                    <RowIconBtn
                      title="Request changes"
                      accent="var(--status-warning)"
                      accentBg="var(--status-warning-bg)"
                      onClick={(e) => { e.stopPropagation(); onRequestChanges(meeting); }}
                    >
                      <XCircle size={14} />
                    </RowIconBtn>
                  )}
                  {(meeting.status === 'completed' || meeting.status === 'changes_requested') && onReopen && (
                    <RowIconBtn
                      title="Reopen"
                      accent="var(--color-primary)"
                      accentBg="var(--status-info-bg)"
                      onClick={(e) => { e.stopPropagation(); onReopen(meeting); }}
                    >
                      <RotateCcw size={14} />
                    </RowIconBtn>
                  )}
                  <button className="btn btn-ghost btn-sm" type="button" onClick={(e) => { e.stopPropagation(); setFilesFor(meeting); }}>
                    Files
                  </button>
                  {canDelete && (
                    <RowIconBtn
                      title="Delete"
                      accent="var(--status-danger)"
                      accentBg="var(--status-danger-bg)"
                      disabled={deletingId === meeting.id}
                      onClick={(e) => { e.stopPropagation(); handleDelete(meeting.id); }}
                    >
                      {deletingId === meeting.id ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <Trash2 size={13} />}
                    </RowIconBtn>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <MeetingFilesModal
        open={!!filesFor}
        meeting={filesFor}
        isAdmin={isAdmin}
        onClose={() => setFilesFor(null)}
      />
    </div>
  );
}
