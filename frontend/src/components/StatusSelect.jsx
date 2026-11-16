import React from 'react';

/**
 * Compact colored status pill that doubles as a change-status control.
 *
 *   <StatusSelect kind="task" value={t.status} onChange={(s) => updateStatus(t.id, s)} />
 *
 * Shows the current status as a colored pill (bg + dot in the status' accent
 * colour). A native <select> is overlaid invisibly so clicking the pill opens
 * the OS-native picker — keeps keyboard / a11y for free, and the visual is
 * 100% inline-styled so cache can never break the colour coding.
 *
 * `kind` controls which set of statuses appears:
 *   - "task"    → pending / in_progress / submitted / completed / rejected / changes_requested / blocked
 *   - "meeting" → scheduled / submitted / completed / changes_requested / cancelled
 */

const TASK_STATUS = {
  pending:           { label: 'Pending',           color: 'var(--st-neutral)', bg: 'var(--st-neutral-bg)' },
  in_progress:       { label: 'In Progress',       color: 'var(--st-purple)', bg: 'var(--st-purple-bg)' },
  submitted:         { label: 'Under review',      color: 'var(--st-orange)', bg: 'var(--st-orange-bg)' },
  completed:         { label: 'Completed',         color: 'var(--st-green)', bg: 'var(--st-green-bg)' },
  rejected:          { label: 'Rejected',          color: 'var(--st-red)', bg: 'var(--st-red-bg)' },
  changes_requested: { label: 'Changes requested', color: 'var(--st-red)', bg: 'var(--st-red-bg)' },
  blocked:           { label: 'Blocked',           color: 'var(--st-red)', bg: 'var(--st-red-bg)' },
};

const MEETING_STATUS = {
  scheduled:         { label: 'Scheduled',         color: 'var(--st-purple)', bg: 'var(--st-purple-bg)' },
  submitted:         { label: 'Submitted',         color: 'var(--st-orange)', bg: 'var(--st-orange-bg)' },
  completed:         { label: 'Completed',         color: 'var(--st-green)', bg: 'var(--st-green-bg)' },
  changes_requested: { label: 'Changes requested', color: 'var(--st-red)', bg: 'var(--st-red-bg)' },
  cancelled:         { label: 'Cancelled',         color: 'var(--st-neutral)', bg: 'var(--st-neutral-bg)' },
};

const MAPS = { task: TASK_STATUS, meeting: MEETING_STATUS };

export default function StatusSelect({
  kind = 'task',
  value,
  onChange,
  disabled = false,
  width = 150,
  allowedOptions = null,
}) {
  const map = MAPS[kind] || TASK_STATUS;
  const meta = map[value] || { label: value || '—', color: '#475569', bg: 'rgba(71,85,105,0.10)' };
  const base = allowedOptions || Object.keys(map);
  const options = base.includes(value) ? base : [value, ...base];

  return (
    <label
      className="tf-status-select"
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 10px 5px 9px',
        borderRadius: 999,
        background: meta.bg,
        border: `1px solid color-mix(in srgb, ${meta.color} 28%, transparent)`,
        color: meta.color,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '-0.005em',
        cursor: disabled ? 'default' : 'pointer',
        width,
        boxSizing: 'border-box',
        opacity: disabled ? 0.7 : 1,
        transition: 'background 100ms, border-color 100ms',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <span
        style={{
          flexShrink: 0,
          width: 7,
          height: 7,
          borderRadius: 999,
          background: meta.color,
          boxShadow: `0 0 0 2px color-mix(in srgb, ${meta.color} 28%, transparent)`,
        }}
      />
      <span
        style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {meta.label}
      </span>
      <svg
        width="16"
        height="16"
        viewBox="0 0 12 12"
        aria-hidden
        style={{ flexShrink: 0, opacity: 0.9 }}
      >
        <path d="M2 4l4 4 4-4" style={{ stroke: meta.color }} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <select
        value={value || ''}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        aria-label="Change status"
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0,
          width: '100%',
          height: '100%',
          cursor: disabled ? 'default' : 'pointer',
          border: 'none',
          background: 'transparent',
          fontFamily: 'inherit',
        }}
      >
        {options.map((s) => (
          <option key={s} value={s}>
            {(map[s] && map[s].label) || s}
          </option>
        ))}
      </select>
    </label>
  );
}
