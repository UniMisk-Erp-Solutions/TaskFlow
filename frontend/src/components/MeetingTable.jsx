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
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, color: active ? '#999' : '#444', letterSpacing: '0.3px', textTransform: 'uppercase' }}>
        {label}
        {sortKey && (active
          ? (sort.dir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)
          : <ChevronDown size={10} style={{ opacity: 0.3 }} />)}
      </div>
    </th>
  );
}

const STATUSES = ['scheduled', 'completed', 'cancelled'];

export default function MeetingTable({ meetings, onDelete, onUpdateStatus, canDelete = true, isAdmin = false, profileById }) {
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
        <div style={{ fontSize: 13, color: '#444' }}>No meetings found</div>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ background: '#0c0c0c' }}>
          <tr style={{ borderBottom: '1px solid #1e1e1e' }}>
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
              style={{ borderBottom: '1px solid #191919', transition: 'background 80ms ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#0f0f0f'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>

              <td style={{ padding: '11px 14px', maxWidth: 300 }}>
                <div style={{ fontWeight: 500, color: '#ddd', fontSize: 13, marginBottom: meeting.description ? 2 : 0 }}>
                  {meeting.title}
                </div>
                {meeting.description && (
                  <div style={{ fontSize: 11, color: '#444', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260 }}>
                    {meeting.description}
                  </div>
                )}
              </td>

              {profileById && (
                <td style={{ padding: '11px 14px', fontSize: 11, color: '#666', maxWidth: 120 }}>
                  {meeting.project_name || '—'}
                </td>
              )}
              {profileById && (
                <td style={{ padding: '11px 14px', fontSize: 11, color: '#888', maxWidth: 140 }}>
                  {formatAssignees(meeting, profileById)}
                </td>
              )}

              <td style={{ padding: '11px 14px' }}>
                <PriorityBadge priority={meeting.priority} />
              </td>

              <td style={{ padding: '11px 14px' }}>
                <select
                  value={meeting.status}
                  onChange={(e) => onUpdateStatus(meeting.id, e.target.value)}
                  style={{
                    background: '#111', border: '1px solid #222', color: '#bbb',
                    borderRadius: 4, padding: '4px 8px', fontSize: 12,
                    fontFamily: 'inherit', cursor: 'pointer', outline: 'none',
                    width: 128,
                  }}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s} style={{ background: '#191919' }}>
                      {s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </option>
                  ))}
                </select>
              </td>

              <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: 12, color: '#555' }}>
                  {fmt(meeting.meeting_date)}
                </span>
                <div style={{ fontSize: 11, color: '#777', marginTop: 2 }}>
                  {fmtTime(meeting.meeting_time)}
                </div>
              </td>

              <td style={{ padding: '11px 14px' }}>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className="btn btn-ghost btn-sm" type="button" onClick={() => setFilesFor(meeting)}>
                    Files
                  </button>
                  {canDelete && (
                    <button onClick={() => handleDelete(meeting.id)} disabled={deletingId === meeting.id}
                      style={{
                        background: 'none', border: '1px solid transparent', borderRadius: 4,
                        cursor: 'pointer', padding: '5px 6px', color: '#444',
                        display: 'flex', alignItems: 'center', transition: 'all 100ms ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.borderColor = 'rgba(248,113,113,0.2)'; e.currentTarget.style.background = 'rgba(248,113,113,0.05)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = '#444'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'none'; }}>
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
