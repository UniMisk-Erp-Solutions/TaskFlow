import React, { useEffect, useState } from 'react';
import api from '../api';

export default function MultiEmployeeSelect({ value = [], onChange }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/auth/profiles')
      .then(({ data }) => {
        setEmployees((data || []).filter((p) => p.role === 'employee'));
      })
      .catch(() => setEmployees([]))
      .finally(() => setLoading(false));
  }, []);

  function toggle(id) {
    if (value.includes(id)) onChange(value.filter((x) => x !== id));
    else onChange([...value, id]);
  }

  if (loading) {
    return <div style={{ fontSize: 12, color: '#555' }}>Loading team…</div>;
  }

  if (!employees.length) {
    return <div style={{ fontSize: 12, color: '#555' }}>No employees in workspace yet.</div>;
  }

  return (
    <div
      style={{
        maxHeight: 180,
        overflowY: 'auto',
        border: '1px solid #1e1e1e',
        borderRadius: 6,
        padding: '8px 10px',
        background: '#0e0e0e',
      }}
    >
      {employees.map((e) => (
        <label
          key={e.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 4px',
            cursor: 'pointer',
            fontSize: 13,
            color: '#bbb',
          }}
        >
          <input
            type="checkbox"
            checked={value.includes(e.id)}
            onChange={() => toggle(e.id)}
            style={{ accentColor: '#e4e4e4' }}
          />
          <span>{e.full_name || e.email}</span>
        </label>
      ))}
    </div>
  );
}
