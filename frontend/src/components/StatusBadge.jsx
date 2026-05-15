import React from 'react';

const STATUS_MAP = {
  pending:           { label: 'Pending',            cls: 'badge-muted'  },
  in_progress:       { label: 'In Progress',        cls: 'badge-indigo' },
  submitted:         { label: 'Submitted',          cls: 'badge-yellow' },
  completed:         { label: 'Completed',          cls: 'badge-green'  },
  changes_requested: { label: 'Changes requested',  cls: 'badge-red'    },
  blocked:           { label: 'Blocked',            cls: 'badge-red'    },
};

const PRIORITY_MAP = {
  high:   { label: 'High',   cls: 'badge-red'    },
  medium: { label: 'Medium', cls: 'badge-yellow' },
  low:    { label: 'Low',    cls: 'badge-muted'  },
};

export default function StatusBadge({ status }) {
  const { label, cls } = STATUS_MAP[status] || { label: status, cls: 'badge-muted' };
  return <span className={`badge ${cls}`}>{label}</span>;
}

export function PriorityBadge({ priority }) {
  const { label, cls } = PRIORITY_MAP[priority] || { label: priority, cls: 'badge-muted' };
  return <span className={`badge ${cls}`}>{label}</span>;
}
