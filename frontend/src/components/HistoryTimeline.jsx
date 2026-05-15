import React from 'react';

function formatTimestamp(ts) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

function actionLabel(action) {
  switch (action) {
    case 'created': return 'created';
    case 'updated': return 'edited';
    case 'status_changed': return 'changed status';
    case 'submitted': return 'submitted for review';
    case 'approved': return 'approved';
    case 'changes_requested': return 'requested changes';
    default: return action || 'updated';
  }
}

function fieldLabel(k) {
  switch (k) {
    case 'title': return 'Title';
    case 'description': return 'Description';
    case 'priority': return 'Priority';
    case 'due_date': return 'Due date';
    case 'due_time': return 'Due time';
    case 'project_id': return 'Project';
    case 'parent_task_id': return 'Parent task';
    case 'parent_meeting_id': return 'Parent meeting';
    case 'meeting_date': return 'Meeting date';
    case 'meeting_time': return 'Meeting time';
    case 'status': return 'Status';
    case 'assignees': return 'Assignees';
    case 'assignee_ids': return 'Assignees';
    default: return k;
  }
}

function valueLabel(v) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'string') {
    if (v.length > 60) return `${v.slice(0, 57)}…`;
    return v;
  }
  if (Array.isArray(v)) return v.length ? `${v.length} item(s)` : '—';
  return JSON.stringify(v);
}

function renderChanges(action, changes, profileById) {
  if (!changes || typeof changes !== 'object') return null;
  const entries = Object.entries(changes);
  if (!entries.length) return null;

  if (action === 'status_changed' && changes.status) {
    const { from, to } = changes.status;
    return (
      <div style={{ fontSize: 12, color: 'var(--tf-muted)', marginTop: 4 }}>
        {valueLabel(from)} → <strong style={{ color: 'var(--tf-text)' }}>{valueLabel(to)}</strong>
      </div>
    );
  }

  return (
    <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 12, color: 'var(--tf-muted)' }}>
      {entries.map(([k, v]) => {
        if (k === 'assignees' && v && typeof v === 'object') {
          const added = (v.added || []).map((id) => profileById?.[id] || id.slice(0, 8));
          const removed = (v.removed || []).map((id) => profileById?.[id] || id.slice(0, 8));
          return (
            <li key={k} style={{ marginBottom: 2 }}>
              <strong style={{ color: 'var(--tf-text)' }}>Assignees</strong>
              {added.length ? <span> · added {added.join(', ')}</span> : null}
              {removed.length ? <span> · removed {removed.join(', ')}</span> : null}
            </li>
          );
        }
        if (v && typeof v === 'object' && 'from' in v && 'to' in v) {
          return (
            <li key={k} style={{ marginBottom: 2 }}>
              <strong style={{ color: 'var(--tf-text)' }}>{fieldLabel(k)}</strong>{': '}
              {valueLabel(v.from)} → {valueLabel(v.to)}
            </li>
          );
        }
        return (
          <li key={k} style={{ marginBottom: 2 }}>
            <strong style={{ color: 'var(--tf-text)' }}>{fieldLabel(k)}</strong>{': '}
            {valueLabel(v)}
          </li>
        );
      })}
    </ul>
  );
}

export default function HistoryTimeline({ entries = [], profileById = {} }) {
  return (
    <div style={{ borderTop: '1px solid var(--tf-border)', paddingTop: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tf-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>
        Timeline
      </div>
      {entries.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--tf-muted)' }}>No activity recorded yet.</div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {entries.map((e) => {
            const actor = profileById?.[e.actor_id] || (e.actor_id ? e.actor_id.slice(0, 8) : 'System');
            return (
              <li key={e.id} style={{ borderLeft: '2px solid var(--tf-border)', paddingLeft: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--tf-text)' }}>
                  <strong>{actor}</strong> {actionLabel(e.action)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--tf-muted)' }}>{formatTimestamp(e.created_at)}</div>
                {renderChanges(e.action, e.changes, profileById)}
                {e.note ? (
                  <div style={{ fontSize: 12, color: 'var(--tf-text)', marginTop: 4, padding: 8, background: 'var(--tf-pearl)', borderRadius: 6, whiteSpace: 'pre-wrap' }}>
                    {e.note}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
