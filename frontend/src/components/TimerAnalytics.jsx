import React, { useMemo, useState } from 'react';
import { Activity, ChevronDown, Clock3, ListChecks, Users } from 'lucide-react';
import { elapsedSecondsForSession, formatElapsedSeconds } from '../lib/taskTimer';

function DottedTaskChart({ rows }) {
  const points = rows;
  const max = Math.max(1, ...points.map((row) => row.seconds));
  const width = Math.max(320, 20 + Math.max(1, points.length - 1) * 46 + 20);
  const coords = points.map((row, index) => ({
    x: points.length < 2 ? 160 : 20 + index * 46,
    y: 98 - (row.seconds / max) * 78,
  }));
  return (
    <svg className="timer-chart" viewBox={`0 0 ${width} 112`} role="img" aria-label="Tracked time by task; dotted line and points show each task">
      {[20, 45, 70, 98].map((y) => <line key={y} x1="14" x2={width - 14} y1={y} y2={y} className="timer-chart-grid" />)}
      {coords.length > 1 && <polyline points={coords.map((point) => `${point.x},${point.y}`).join(' ')} className="timer-chart-line" />}
      {coords.map((point, index) => <circle key={`${points[index].id}-${index}`} cx={point.x} cy={point.y} r="4" className="timer-chart-dot"><title>{`${points[index].title}: ${formatElapsedSeconds(points[index].seconds)}`}</title></circle>)}
    </svg>
  );
}

// Table order: running/in progress first, then to do, then review/rejected, then completed.
function statusGroup(row) {
  const { task } = row;
  if (task.status === 'completed') return { rank: 3, label: 'Completed', tracked: true };
  if (task.status === 'submitted') return { rank: 2, label: 'Under review', tracked: true };
  if (task.status === 'rejected') return { rank: 2, label: 'Rejected', tracked: true };
  const column = task.kanban_column || 'to_do';
  if (row.active || column === 'in_progress' || task.status === 'in_progress') {
    return { rank: 0, label: row.active ? 'Running' : 'In progress', tracked: true };
  }
  // To do / backlog tasks have no timer, so their tracked time stays empty.
  return { rank: 1, label: column === 'backlog' ? 'Backlog' : 'To do', tracked: false };
}

const STATUS_FILTERS = [
  { key: 'in_progress', label: 'In progress', rank: 0 },
  { key: 'to_do', label: 'To do', rank: 1 },
  { key: 'review', label: 'Under review', rank: 2 },
  { key: 'completed', label: 'Completed', rank: 3 },
];

function PersonCard({ person, rows, averageSeconds, defaultOpen, showPerson }) {
  const [open, setOpen] = useState(defaultOpen);
  const [filter, setFilter] = useState('all');
  const name = person.full_name || person.email || 'Team member';
  const count = (rank) => rows.filter((row) => row.group.rank === rank).length;
  const totalSeconds = rows.reduce((sum, row) => sum + row.seconds, 0);
  const running = rows.some((row) => row.active);
  const panelId = `timer-person-${person.id}`;
  const active = STATUS_FILTERS.find((item) => item.key === filter);
  const visibleRows = active ? rows.filter((row) => row.group.rank === active.rank) : rows;
  return (
    <article className={`timer-person-card${open ? ' is-open' : ''}`}>
      <button type="button" className="timer-person-head" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((value) => !value)}>
        <span className="timer-person-avatar" aria-hidden="true">{name.trim().charAt(0).toUpperCase() || '?'}</span>
        <span className="timer-person-title">
          <strong>{showPerson ? name : 'My tasks'}</strong>
          <span className="timer-person-chips">
            <span className="timer-chip">{rows.length} task{rows.length === 1 ? '' : 's'}</span>
            {count(0) > 0 && <span className="timer-chip is-progress">{count(0)} in progress</span>}
            {count(1) > 0 && <span className="timer-chip">{count(1)} to do</span>}
            {count(2) > 0 && <span className="timer-chip is-review">{count(2)} review</span>}
            {count(3) > 0 && <span className="timer-chip is-done">{count(3)} completed</span>}
            {running && <span className="timer-chip is-running">Running</span>}
          </span>
        </span>
        <span className="timer-person-stat"><small>Total tracked</small><strong>{formatElapsedSeconds(totalSeconds)}</strong></span>
        <span className="timer-person-stat"><small>Avg / completed</small><strong>{averageSeconds ? formatElapsedSeconds(averageSeconds) : '—'}</strong></span>
        <ChevronDown size={18} className="timer-person-chevron" aria-hidden="true" />
      </button>
      {open && (
        <div className="timer-task-panel" id={panelId}>
          <div className="timer-filter-bar" role="group" aria-label={`Filter ${name}'s tasks by status`}>
            {[{ key: 'all', label: 'All', total: rows.length }, ...STATUS_FILTERS.map((item) => ({ ...item, total: count(item.rank) }))]
              .filter((item) => item.key === 'all' || item.total > 0)
              .map((item) => (
                <button type="button" key={item.key} className={`timer-filter-btn${filter === item.key ? ' is-active' : ''}`}
                  aria-pressed={filter === item.key} onClick={() => setFilter(item.key)}>
                  {item.label}<span>{item.total}</span>
                </button>
              ))}
          </div>
          {visibleRows.length ? (
            <ul className="timer-task-list">
              {visibleRows.map((row) => (
                <li key={row.id} className="timer-task-row">
                  <span className="timer-task-title">{row.task.title}</span>
                  <span className={`timer-status is-rank-${row.group.rank}`}>{row.group.label}</span>
                  <span className="timer-task-time">{row.group.tracked ? formatElapsedSeconds(row.seconds) : ''}</span>
                </li>
              ))}
            </ul>
          ) : <div className="timer-empty">No tasks with this status.</div>}
        </div>
      )}
    </article>
  );
}

export default function TimerAnalytics({ tasks = [], sessions = [], people = [], directoryProfiles = [], profile, isAdmin, loading, error }) {
  const [now, setNow] = useState(Date.now());
  React.useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const analytics = useMemo(() => {
    const personById = new Map(directoryProfiles.map((person) => [person.id, person]));
    people.forEach((person) => personById.set(person.id, { ...personById.get(person.id), ...person }));
    const totals = new Map();
    const totalByPersonTask = new Map();
    const activePersonTaskKeys = new Set();
    let totalSeconds = 0;
    let activeCount = 0;
    for (const session of sessions) {
      const seconds = elapsedSecondsForSession(session, now);
      totalSeconds += seconds;
      if (!session.ended_at) activeCount += 1;
      totals.set(session.task_id, (totals.get(session.task_id) || 0) + seconds);
      const key = `${session.task_id}:${session.user_id}`;
      totalByPersonTask.set(key, (totalByPersonTask.get(key) || 0) + seconds);
      if (!session.ended_at) activePersonTaskKeys.add(key);
    }
    const taskRows = tasks.map((task) => ({ ...task, seconds: totals.get(task.id) || 0 }))
      .sort((a, b) => b.seconds - a.seconds || String(a.title).localeCompare(String(b.title)));
    const personTaskRows = [];
    const personIds = isAdmin
      ? [...new Set([...tasks.flatMap((task) => task.assignee_ids?.length ? task.assignee_ids : task.assignee_id ? [task.assignee_id] : []), ...sessions.map((session) => session.user_id)])]
      : profile?.id ? [profile.id] : [];
    for (const personId of personIds) {
      const assigned = tasks.filter((task) =>
        (task.assignee_ids?.length ? task.assignee_ids : task.assignee_id ? [task.assignee_id] : []).includes(personId)
        || totalByPersonTask.has(`${task.id}:${personId}`),
      );
      const completed = assigned.filter((task) =>
        task.status === 'completed' && (totalByPersonTask.get(`${task.id}:${personId}`) || 0) > 0,
      );
      const completedSeconds = completed.reduce((sum, task) => sum + (totalByPersonTask.get(`${task.id}:${personId}`) || 0), 0);
      for (const task of assigned) {
        personTaskRows.push({
          id: `${personId}:${task.id}`,
          task,
          person: personById.get(personId) || (personId === profile?.id ? profile : { id: personId, full_name: `Unlinked member · ${String(personId).slice(0, 8)}` }),
          seconds: totalByPersonTask.get(`${task.id}:${personId}`) || 0,
          active: activePersonTaskKeys.has(`${task.id}:${personId}`),
        });
      }
      personById.set(personId, {
        ...(personById.get(personId) || {}), id: personId,
        averageSeconds: completed.length ? Math.floor(completedSeconds / completed.length) : null,
      });
    }
    personTaskRows.forEach((row) => { row.group = statusGroup(row); });
    personTaskRows.sort((a, b) => a.group.rank - b.group.rank
      || String(a.person.full_name || a.person.email || '').localeCompare(String(b.person.full_name || b.person.email || ''))
      || String(a.task.title).localeCompare(String(b.task.title)));
    const byPerson = new Map();
    personTaskRows.forEach((row) => {
      if (!byPerson.has(row.person.id)) byPerson.set(row.person.id, []);
      byPerson.get(row.person.id).push(row);
    });
    const peopleCards = [...byPerson.entries()].map(([id, rows]) => ({
      person: rows[0].person, rows, averageSeconds: personById.get(id)?.averageSeconds ?? null,
    })).sort((a, b) => String(a.person.full_name || a.person.email || '').localeCompare(String(b.person.full_name || b.person.email || '')));
    return { totalSeconds, activeCount, taskRows, personTaskRows, peopleCards, peopleWithAverages: [...personById.values()] };
  }, [tasks, sessions, people, profile, isAdmin, now]);

  const topTaskRows = analytics.taskRows.filter((task) => task.seconds > 0);
  return (
    <section className="timer-analytics" aria-label="Task timer analytics">
      {error && <div className="timer-error" role="alert">{error}</div>}
      <div className="timer-summary-grid">
        <div className="timer-summary-card"><Clock3 size={18} /><span>Total tracked</span><strong>{formatElapsedSeconds(analytics.totalSeconds)}</strong></div>
        <div className="timer-summary-card"><Activity size={18} /><span>Running now</span><strong>{analytics.activeCount}</strong></div>
        <div className="timer-summary-card"><ListChecks size={18} /><span>Tasks tracked</span><strong>{topTaskRows.length}</strong></div>
        {isAdmin && <div className="timer-summary-card"><Users size={18} /><span>People tracked</span><strong>{new Set(sessions.map((session) => session.user_id)).size}</strong></div>}
      </div>

      <section className="timer-panel">
        <div className="timer-panel-heading"><div><h2>Time by task</h2><p>Dotted points compare recorded time for each task.</p></div></div>
        {topTaskRows.length ? <div className="timer-chart-wrap"><DottedTaskChart rows={topTaskRows} /></div> : <div className="timer-empty">Timers will appear here once work is started.</div>}
      </section>

      <section className="timer-panel">
        <div className="timer-panel-heading"><div><h2>{isAdmin ? 'People and task time' : 'My task time'}</h2><p>{isAdmin ? 'Each assigned person and task has its own timer total. Average completion uses approved tasks.' : 'Your recorded time is listed separately for each assigned task.'}</p></div></div>
        {loading ? <div className="timer-empty">Loading timer data…</div> : analytics.peopleCards.length ? (
          <div className="timer-person-grid">
            {analytics.peopleCards.map((card) => (
              <PersonCard key={card.person.id} person={card.person} rows={card.rows} averageSeconds={card.averageSeconds} showPerson={isAdmin} defaultOpen={!isAdmin} />
            ))}
          </div>
        ) : <div className="timer-empty">No assigned tasks to show.</div>}
      </section>
    </section>
  );
}
