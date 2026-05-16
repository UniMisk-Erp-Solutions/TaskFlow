import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import GoogleConnectCard from './GoogleConnectCard';

function ymd(date) {
  return date.toISOString().split('T')[0];
}

function monthGrid(baseDate) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();

  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);

  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  const end = new Date(last);
  end.setDate(last.getDate() + (6 - last.getDay()));

  const days = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function prettyMonth(date) {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function eventDate(item) {
  return item.meeting_date || item.due_date || null;
}

function formatMeetingTime(timeValue) {
  if (!timeValue) return '';
  const [h, m] = timeValue.split(':');
  const date = new Date();
  date.setHours(Number(h || 0), Number(m || 0), 0, 0);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function CalenderView({
  tasks = [],
  meetings = [],
  filters,
  onFiltersChange,
  assignees = [],
  includeEmployeeFilter = false,
  onSelectEvent = undefined,
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const today = ymd(new Date());

  const taskEvents = tasks.map((t) => ({
    id: `task-${t.id}`,
    name: t.title,
    date: eventDate(t),
    type: 'task',
    assignee_id: (t.assignee_ids && t.assignee_ids[0]) || t.assignee_id || '',
    payload: { kind: 'task', row: t },
  }));

  const meetingEvents = meetings.map((m) => ({
    id: `meeting-${m.id}`,
    name: m.title,
    date: eventDate(m),
    type: 'meeting',
    assignee_id: (m.assignee_ids && m.assignee_ids[0]) || m.assignee_id || '',
    meeting_time: m.meeting_time || '',
    payload: { kind: 'meeting', row: m },
  }));

  const events = useMemo(() => {
    return [...taskEvents, ...meetingEvents]
      .filter((e) => !!e.date)
      .filter((e) => {
        const q = (filters.search || '').toLowerCase();
        if (q && !e.name.toLowerCase().includes(q)) return false;
        if (filters.type && e.type !== filters.type) return false;
        if (filters.assignee_id && e.assignee_id !== filters.assignee_id) return false;
        return true;
      });
  }, [tasks, meetings, filters.search, filters.type, filters.assignee_id]);

  const byDay = useMemo(() => {
    const map = {};
    for (const e of events) {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    }
    return map;
  }, [events]);

  const days = monthGrid(currentMonth);

  const monthTaskCount = events.filter((e) => e.type === 'task').length;
  const monthMeetingCount = events.filter((e) => e.type === 'meeting').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Google Calendar connect bar — sits above the month grid so it's
          unmistakable from any page state. */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, flexWrap: 'wrap',
          padding: '10px 14px',
          border: '1px solid var(--tf-border)',
          borderRadius: 14,
          background: 'var(--tf-panel)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tf-text)', letterSpacing: '-0.005em' }}>
            Sync with Google Calendar
          </span>
          <span style={{ fontSize: 12, color: 'var(--tf-muted)' }}>
            Connect your Gmail to auto-push new meetings to your Google calendar.
          </span>
        </div>
        <GoogleConnectCard variant="inline" />
      </div>

      <div style={{ border: '1px solid var(--tf-border)', borderRadius: 18, background: 'var(--tf-panel)', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--tf-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}>
              <ChevronLeft size={14} />
            </button>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--tf-text)', minWidth: 170 }}>{prettyMonth(currentMonth)}</div>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}>
              <ChevronRight size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              className="input"
              placeholder="Search tasks and meetings"
              value={filters.search}
              onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
              style={{ width: 220 }}
            />
            <select className="select" value={filters.type || ''} onChange={(e) => onFiltersChange({ ...filters, type: e.target.value })} style={{ width: 140 }}>
              <option value="">All Types</option>
              <option value="task">Tasks</option>
              <option value="meeting">Meetings</option>
            </select>
            {includeEmployeeFilter && (
              <select className="select" value={filters.assignee_id || ''} onChange={(e) => onFiltersChange({ ...filters, assignee_id: e.target.value })} style={{ width: 200 }}>
                <option value="">All team members</option>
                {assignees.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name || a.email}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--tf-border)', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--tf-muted)' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--color-primary)', display: 'inline-block' }} />
            Tasks ({monthTaskCount})
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--tf-muted)' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--status-success)', display: 'inline-block' }} />
            Meetings ({monthMeetingCount})
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--tf-border)' }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} style={{ padding: '8px 10px', fontSize: 11, color: 'var(--tf-muted)', textTransform: 'uppercase', letterSpacing: '0.3px', textAlign: 'center' }}>
              {d}
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {days.map((day) => {
            const date = ymd(day);
            const dayEvents = byDay[date] || [];
            const inMonth = day.getMonth() === currentMonth.getMonth();
            const isToday = date === today;

            return (
              <div key={date} style={{ minHeight: 110, borderRight: '1px solid var(--color-divider-soft)', borderBottom: '1px solid var(--color-divider-soft)', padding: 8, background: inMonth ? 'var(--tf-panel)' : 'var(--tf-pearl)' }}>
                <div style={{ fontSize: 12, color: isToday ? 'var(--tf-text)' : inMonth ? 'var(--tf-muted)' : 'var(--tf-muted)', marginBottom: 6, fontWeight: isToday ? 600 : 400 }}>
                  {day.getDate()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {dayEvents.slice(0, 3).map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      title={e.type === 'meeting' && e.meeting_time ? `${formatMeetingTime(e.meeting_time)} • ${e.name}` : e.name}
                      disabled={!onSelectEvent}
                      onClick={() => onSelectEvent?.(e.payload)}
                      style={{
                        fontFamily: 'inherit',
                        border: 'none',
                        cursor: onSelectEvent ? 'pointer' : 'default',
                        textAlign: 'left',
                        width: '100%',
                        fontSize: 11,
                        borderRadius: 5,
                        padding: '3px 6px',
                        background: e.type === 'task' ? 'rgba(59,130,246,0.2)' : 'rgba(34,197,94,0.2)',
                        color: e.type === 'task' ? 'var(--color-primary-on-dark)' : 'var(--status-success)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        opacity: onSelectEvent ? 1 : 0.92,
                      }}
                    >
                      {e.type === 'meeting' && e.meeting_time ? `${formatMeetingTime(e.meeting_time)} ${e.name}` : e.name}
                    </button>
                  ))}
                  {dayEvents.length > 3 && (
                    <span style={{ fontSize: 11, color: 'var(--tf-muted)' }}>+{dayEvents.length - 3} more</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
