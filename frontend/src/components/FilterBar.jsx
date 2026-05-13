import React from 'react';
import { Search, X } from 'lucide-react';

export default function FilterBar({
  filters,
  onChange,
  onClear,
  assignees = [],
  includeType = false,
  includeAssignee = false,
  searchPlaceholder = 'Search tasks',
}) {
  const hasFilter =
    filters.search || filters.status || filters.priority || filters.type || filters.assignee_id;

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
        <Search size={17} strokeWidth={2} style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', color: 'var(--tf-muted)', pointerEvents: 'none' }} />
        <input
          className="input"
          style={{ paddingLeft: 48 }}
          placeholder={searchPlaceholder}
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
        />
      </div>
      {includeType && (
        <select className="select" style={{ width: 140 }} value={filters.type || ''} onChange={(e) => onChange({ ...filters, type: e.target.value })}>
          <option value="">All Types</option>
          <option value="task">Tasks</option>
          <option value="meeting">Meetings</option>
        </select>
      )}
      <select className="select" style={{ width: 140 }} value={filters.status} onChange={(e) => onChange({ ...filters, status: e.target.value })}>
        <option value="">All Statuses</option>
        <option value="pending">Pending</option>
        <option value="in_progress">In Progress</option>
        <option value="completed">Completed</option>
        <option value="blocked">Blocked</option>
        <option value="scheduled">Scheduled</option>
        <option value="cancelled">Cancelled</option>
      </select>
      <select className="select" style={{ width: 132 }} value={filters.priority} onChange={(e) => onChange({ ...filters, priority: e.target.value })}>
        <option value="">All Priorities</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
      {includeAssignee && (
        <select className="select" style={{ width: 180 }} value={filters.assignee_id || ''} onChange={(e) => onChange({ ...filters, assignee_id: e.target.value })}>
          <option value="">All Employees</option>
          {assignees.map((a) => (
            <option key={a.id} value={a.id}>
              {a.full_name || a.email}
            </option>
          ))}
        </select>
      )}
      {hasFilter && (
        <button className="btn btn-ghost btn-sm" onClick={onClear}>
          <X size={12} /> Clear
        </button>
      )}
    </div>
  );
}
