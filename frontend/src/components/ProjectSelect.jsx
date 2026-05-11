import React from 'react';

export default function ProjectSelect({ projects = [], value, onChange, disabled }) {
  return (
    <select
      className="select"
      disabled={disabled}
      value={value || ''}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <option value="">No project (general backlog)</option>
      {projects.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
