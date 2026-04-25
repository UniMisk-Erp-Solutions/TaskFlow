import React from 'react';
import { Search, X } from 'lucide-react';

export default function FilterBar({ filters, onChange, onClear }) {
  const hasFilter = filters.search || filters.status || filters.priority;
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
        <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#444', pointerEvents: 'none' }} />
        <input className="input" style={{ paddingLeft: 32 }} placeholder="Search tasks" value={filters.search} onChange={(e) => onChange({ ...filters, search: e.target.value })} />
      </div>
      <select className="select" style={{ width: 140 }} value={filters.status} onChange={(e) => onChange({ ...filters, status: e.target.value })}>
        <option value="">All Statuses</option>
        <option value="pending">Pending</option>
        <option value="in_progress">In Progress</option>
        <option value="completed">Completed</option>
        <option value="blocked">Blocked</option>
      </select>
      <select className="select" style={{ width: 132 }} value={filters.priority} onChange={(e) => onChange({ ...filters, priority: e.target.value })}>
        <option value="">All Priorities</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
      {hasFilter && (
        <button className="btn btn-ghost btn-sm" onClick={onClear}>
          <X size={12} /> Clear
        </button>
      )}
    </div>
  );
}
