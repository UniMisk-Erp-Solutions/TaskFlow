import React, { useEffect, useState } from 'react';
import api from '../api';

/** Org-wide assignee picker: employees + admins (same workspace). */
export default function MultiEmployeeSelect({ value = [], onChange }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/auth/profiles')
      .then(({ data }) => {
        setMembers(data || []);
      })
      .catch(() => setMembers([]))
      .finally(() => setLoading(false));
  }, []);

  function toggle(id) {
    if (value.includes(id)) onChange(value.filter((x) => x !== id));
    else onChange([...value, id]);
  }

  if (loading) {
    return <div style={{ fontSize: 13, color: 'var(--tf-muted)' }}>Loading team…</div>;
  }

  if (!members.length) {
    return <div style={{ fontSize: 13, color: 'var(--tf-muted)' }}>No people in this workspace yet.</div>;
  }

  return (
    <div
      style={{
        maxHeight: 180,
        overflowY: 'auto',
        border: '1px solid var(--tf-border)',
        borderRadius: 11,
        padding: '10px 12px',
        background: 'var(--tf-pearl)',
      }}
    >
      {members.map((e) => (
        <label
          key={e.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 4px',
            cursor: 'pointer',
            fontSize: 14,
            color: 'var(--tf-text)',
          }}
        >
          <input type="checkbox" checked={value.includes(e.id)} onChange={() => toggle(e.id)} style={{ accentColor: 'var(--color-primary)' }} />
          <span>
            {e.full_name || e.email}
            <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--tf-muted)', textTransform: 'capitalize' }}>({e.role})</span>
          </span>
        </label>
      ))}
    </div>
  );
}
