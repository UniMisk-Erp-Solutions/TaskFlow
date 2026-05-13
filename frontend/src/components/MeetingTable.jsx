import React, { useState } from 'react';
import { Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { PriorityBadge } from './StatusBadge';
import MeetingFilesModal from './MeetingFilesModal';

function fmt(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtTime(t) {
  if (!t) return '-';
  const [h, m] = t.split(':');
  const date = new Date();
  date.setHours(Number(h || 0), Number(m || 0), 0, 0);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
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

export default function MeetingTable({ meetings, onDelete, onUpdateStatus, canDelete = true, isAdmin = false, profileById, onOpenMeeting }) {
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
                <select
                  className="tf-select-inline"
                  value={meeting.status}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => onUpdateStatus(meeting.id, e.target.value)}
                  style={{ width: 140 }}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </option>
                  ))}
                </select>
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
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className="btn btn-ghost btn-sm" type="button" onClick={(e) => { e.stopPropagation(); setFilesFor(meeting); }}>
                    Files
                  </button>
                  {canDelete && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(meeting.id); }} disabled={deletingId === meeting.id}
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
                      {deletingId === meeting.id ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <Trash2 size={13} />}
                    </button>
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
