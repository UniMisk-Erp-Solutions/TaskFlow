import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const today = ymd(new Date());

  const taskEvents = tasks.map((t) => ({
    id: `task-${t.id}`,
    name: t.title,
    date: eventDate(t),
    type: 'task',
    assignee_id: (t.assignee_ids && t.assignee_ids[0]) || t.assignee_id || '',
  }));

  const meetingEvents = meetings.map((m) => ({
    id: `meeting-${m.id}`,
    name: m.title,
    date: eventDate(m),
    type: 'meeting',
    assignee_id: (m.assignee_ids && m.assignee_ids[0]) || m.assignee_id || '',
    meeting_time: m.meeting_time || '',
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
      <div style={{ border: '1px solid #1a1a1a', borderRadius: 8, background: '#0c0c0c', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}>
              <ChevronLeft size={14} />
            </button>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#ddd', minWidth: 170 }}>{prettyMonth(currentMonth)}</div>
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
              <select className="select" value={filters.assignee_id || ''} onChange={(e) => onFiltersChange({ ...filters, assignee_id: e.target.value })} style={{ width: 180 }}>
                <option value="">All Employees</option>
                {assignees.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name || a.email}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div style={{ padding: '10px 16px', borderBottom: '1px solid #1a1a1a', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9ca3af' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: '#3b82f6', display: 'inline-block' }} />
            Tasks ({monthTaskCount})
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9ca3af' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: '#22c55e', display: 'inline-block' }} />
            Meetings ({monthMeetingCount})
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #1a1a1a' }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} style={{ padding: '8px 10px', fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: '0.3px', textAlign: 'center' }}>
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
              <div key={date} style={{ minHeight: 110, borderRight: '1px solid #161616', borderBottom: '1px solid #161616', padding: 8, background: inMonth ? '#0c0c0c' : '#0a0a0a' }}>
                <div style={{ fontSize: 12, color: isToday ? '#e5e7eb' : inMonth ? '#777' : '#444', marginBottom: 6, fontWeight: isToday ? 600 : 400 }}>
                  {day.getDate()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {dayEvents.slice(0, 3).map((e) => (
                    <div
                      key={e.id}
                      title={e.type === 'meeting' && e.meeting_time ? `${formatMeetingTime(e.meeting_time)} • ${e.name}` : e.name}
                      style={{
                        fontSize: 11,
                        borderRadius: 5,
                        padding: '3px 6px',
                        background: e.type === 'task' ? 'rgba(59,130,246,0.2)' : 'rgba(34,197,94,0.2)',
                        color: e.type === 'task' ? '#93c5fd' : '#86efac',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {e.type === 'meeting' && e.meeting_time ? `${formatMeetingTime(e.meeting_time)} ${e.name}` : e.name}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <span style={{ fontSize: 10, color: '#555' }}>+{dayEvents.length - 3} more</span>
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
