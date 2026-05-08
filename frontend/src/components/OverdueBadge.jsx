import React from 'react';
import { AlertTriangle } from 'lucide-react';

export function isOverdue(due_date, status) {
  if (!due_date || status === 'completed') return false;
  return new Date(due_date) < new Date(new Date().toDateString());
}

export default function OverdueBadge() {
  return (
    <span className="badge badge-danger" style={{ gap: 3 }}>
      <AlertTriangle size={10} />
      Overdue
    </span>
  );
}
