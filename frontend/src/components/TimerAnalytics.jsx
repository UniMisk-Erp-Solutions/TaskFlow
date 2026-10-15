import React, { useMemo, useState } from 'react';
import { Activity, ChevronDown, Clock3, ListChecks, Users } from 'lucide-react';
import { elapsedSecondsForSession, formatElapsedSeconds } from '../lib/taskTimer';

const PERIODS = [
  { key: 'all', label: 'All time' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
];

const CHART_VIEWS = [
  { key: 'task', label: 'By task' },
  { key: 'time', label: 'Over time' },
  { key: 'person', label: 'By person', adminOnly: true },
];

const DAY_MS = 86_400_000;

function startOfDay(ms) {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function periodStart(period, now) {
  if (period === 'week') {
    const day = new Date(startOfDay(now));
    const offset = (day.getDay() + 6) % 7; // Monday first
    day.setDate(day.getDate() - offset);
    return day.getTime();
  }
  if (period === 'month') {
    const day = new Date(startOfDay(now));
    day.setDate(1);
    return day.getTime();
  }
  return null;
}

function shortDuration(seconds) {
  const total = Math.max(0, Math.round(seconds || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours) return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  if (minutes) return `${minutes}m`;
  return total ? `${total}s` : '0m';
}

/** Splits sessions at midnight and sums seconds per bucket start (day or week). */
function timeBuckets(sessions, period, now) {
  const rangeStart = periodStart(period, now);
  const weekly = period === 'all';
  const bucketKey = (ms) => {
    const day = startOfDay(ms);
    if (!weekly) return day;
    const date = new Date(day);
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    return date.getTime();
  };
  const sums = new Map();
  let earliest = now;
  for (const session of sessions) {
    const start = Date.parse(session.started_at);
    const end = session.ended_at ? Date.parse(session.ended_at) : now;
    if (!Number.isFinite(start) || end <= start) continue;
    earliest = Math.min(earliest, start);
    let cursor = start;
    while (cursor < end) {
      const nextMidnight = startOfDay(cursor) + DAY_MS;
      const chunkEnd = Math.min(end, nextMidnight);
      const key = bucketKey(cursor);
      sums.set(key, (sums.get(key) || 0) + (chunkEnd - cursor) / 1000);
      cursor = chunkEnd;
    }
  }
  const first = rangeStart ?? bucketKey(earliest);
  const last = period === 'week' ? first + 6 * DAY_MS : period === 'month'
    ? (() => { const d = new Date(first); d.setMonth(d.getMonth() + 1, 0); return startOfDay(d.getTime()); })()
    : bucketKey(now);
  const step = weekly ? 7 : 1;
  const buckets = [];
  for (let date = new Date(first); date.getTime() <= last; date.setDate(date.getDate() + step)) {
    const key = date.getTime();
    buckets.push({
      id: key,
      seconds: sums.get(key) || 0,
      label: weekly
        ? date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
        : period === 'week' ? date.toLocaleDateString(undefined, { weekday: 'short' }) : String(date.getDate()),
      title: weekly
        ? `Week of ${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`
        : date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }),
    });
  }
  return weekly ? buckets.slice(-16) : buckets;
}

/** Total seconds worked in each hour of the day (0-23), summed across the sessions. */
function hourBuckets(sessions, now) {
  const sums = new Array(24).fill(0);
  for (const session of sessions) {
    const start = Date.parse(session.started_at);
    const end = session.ended_at ? Date.parse(session.ended_at) : now;
    if (!Number.isFinite(start) || end <= start) continue;
    let cursor = start;
    while (cursor < end) {
      const date = new Date(cursor);
      const nextHour = new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours() + 1).getTime();
      const chunkEnd = Math.min(end, nextHour);
      sums[date.getHours()] += (chunkEnd - cursor) / 1000;
      cursor = chunkEnd;
    }
  }
  return sums.map((seconds, hour) => {
    const suffix = hour < 12 ? 'a' : 'p';
    const label = `${hour % 12 === 0 ? 12 : hour % 12}${suffix}`;
    return { id: hour, seconds, label, title: `${String(hour).padStart(2, '0')}:00 - ${String(hour).padStart(2, '0')}:59` };
  });
}

function HorizontalBars({ rows, limit = 12 }) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? rows : rows.slice(0, limit);
  const max = Math.max(1, ...rows.map((row) => row.seconds));
  return (
    <div className="timer-hbars">
      {shown.map((row) => (
        <div className="timer-hbar" key={row.id} title={`${row.label}: ${formatElapsedSeconds(row.seconds)}`}>
          <span className="timer-hbar-label">{row.label}</span>
          <span className="timer-hbar-track"><span className="timer-hbar-fill" style={{ width: `${Math.max(2, (row.seconds / max) * 100)}%` }} /></span>
          <span className="timer-hbar-value">{shortDuration(row.seconds)}</span>
        </div>
      ))}
      {rows.length > limit && (
        <button type="button" className="timer-link-btn" onClick={() => setShowAll((value) => !value)}>
          {showAll ? 'Show top ' + limit : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  );
}

function ColumnChart({ buckets }) {
  const max = Math.max(1, ...buckets.map((bucket) => bucket.seconds));
  const dense = buckets.length > 16;
  return (
    <div className="timer-columns" role="img" aria-label="Tracked time over time">
      <div className="timer-columns-axis" aria-hidden="true">
        <span>{shortDuration(max)}</span><span>{shortDuration(max / 2)}</span><span>0</span>
      </div>
      <div className={`timer-columns-plot${dense ? ' is-dense' : ''}`}>
        {buckets.map((bucket, index) => (
          <div className="timer-column" key={bucket.id} title={`${bucket.title}: ${formatElapsedSeconds(bucket.seconds)}`}>
            <span className="timer-column-value">{bucket.seconds && !dense ? shortDuration(bucket.seconds) : ''}</span>
            <span className="timer-column-bar-wrap">
              <span className="timer-column-bar" style={{ height: `${bucket.seconds ? Math.max(3, (bucket.seconds / max) * 100) : 0}%` }} />
            </span>
            <span className="timer-column-label">{dense && index % 2 ? '' : bucket.label}</span>
          </div>
        ))}
      </div>
    </div>
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

function PersonCard({ person, rows, averageSeconds, defaultOpen, showPerson, expandCommand }) {
  const [open, setOpen] = useState(defaultOpen);
  React.useEffect(() => {
    if (expandCommand.version) setOpen(expandCommand.open);
  }, [expandCommand]);
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

export default function TimerAnalytics({ tasks = [], sessions: allSessions = [], people = [], directoryProfiles = [], profile, isAdmin, loading, error }) {
  const [now, setNow] = useState(Date.now());
  const [period, setPeriod] = useState('all');
  const [personFilter, setPersonFilter] = useState('all');
  const [chartView, setChartView] = useState('task');
  const [granularity, setGranularity] = useState('day');
  const [expandCommand, setExpandCommand] = useState({ version: 0, open: false });
  React.useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const personOptions = useMemo(() => {
    const byId = new Map(directoryProfiles.map((person) => [person.id, person]));
    people.forEach((person) => byId.set(person.id, { ...byId.get(person.id), ...person }));
    const ids = new Set([
      ...tasks.flatMap((task) => task.assignee_ids?.length ? task.assignee_ids : task.assignee_id ? [task.assignee_id] : []),
      ...allSessions.map((session) => session.user_id),
    ]);
    return [...ids].map((id) => ({ id, name: byId.get(id)?.full_name || byId.get(id)?.email || `Unlinked member · ${String(id).slice(0, 8)}` }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks, allSessions, people, directoryProfiles]);

  // Sessions limited to the chosen person and clipped to the chosen period, so every
  // number below (cards, chart, per-person table) stays consistent with the filters.
  const sessions = useMemo(() => {
    const rangeStart = periodStart(period, now);
    return allSessions.flatMap((session) => {
      if (isAdmin && personFilter !== 'all' && session.user_id !== personFilter) return [];
      if (rangeStart === null) return [session];
      const start = Date.parse(session.started_at || '');
      const end = session.ended_at ? Date.parse(session.ended_at) : now;
      if (!Number.isFinite(start) || end <= rangeStart) return [];
      return [{ ...session, started_at: new Date(Math.max(start, rangeStart)).toISOString() }];
    });
  }, [allSessions, period, personFilter, isAdmin, now]);

  const analytics = useMemo(() => {
    const personById = new Map(directoryProfiles.map((person) => [person.id, person]));
    people.forEach((person) => personById.set(person.id, { ...personById.get(person.id), ...person }));
    const totals = new Map();
    const totalByPersonTask = new Map();
    const totalByPerson = new Map();
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
      totalByPerson.set(session.user_id, (totalByPerson.get(session.user_id) || 0) + seconds);
      if (!session.ended_at) activePersonTaskKeys.add(key);
    }
    const taskRows = tasks.map((task) => ({ ...task, seconds: totals.get(task.id) || 0 }))
      .sort((a, b) => b.seconds - a.seconds || String(a.title).localeCompare(String(b.title)));
    const personTaskRows = [];
    let personIds = isAdmin ? personOptions.map((option) => option.id) : profile?.id ? [profile.id] : [];
    if (isAdmin && personFilter !== 'all') personIds = personIds.filter((id) => id === personFilter);
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
        const seconds = totalByPersonTask.get(`${task.id}:${personId}`) || 0;
        const active = activePersonTaskKeys.has(`${task.id}:${personId}`);
        // Inside a week/month view only list work that actually happened in it.
        if (period !== 'all' && !seconds && !active) continue;
        personTaskRows.push({
          id: `${personId}:${task.id}`,
          task,
          person: personById.get(personId) || (personId === profile?.id ? profile : { id: personId, full_name: `Unlinked member · ${String(personId).slice(0, 8)}` }),
          seconds,
          active,
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
    const personBars = personOptions
      .map((option) => ({ id: option.id, label: option.name, seconds: totalByPerson.get(option.id) || 0 }))
      .filter((row) => row.seconds > 0)
      .sort((a, b) => b.seconds - a.seconds);
    return { totalSeconds, activeCount, taskRows, peopleCards, personBars };
  }, [tasks, sessions, people, directoryProfiles, profile, isAdmin, now, period, personFilter, personOptions]);

  const topTaskRows = analytics.taskRows.filter((task) => task.seconds > 0);
  const buckets = useMemo(
    () => (granularity === 'hour' ? hourBuckets(sessions, now) : timeBuckets(sessions, period, now)),
    [sessions, period, now, granularity],
  );
  const views = CHART_VIEWS.filter((view) => !view.adminOnly || (isAdmin && personFilter === 'all'));
  const activeView = views.some((view) => view.key === chartView) ? chartView : 'task';
  const periodLabel = PERIODS.find((item) => item.key === period)?.label || '';
  const selectedPerson = personFilter !== 'all' ? personOptions.find((option) => option.id === personFilter) : null;
  const chartTitle = activeView === 'task' ? 'Time by task' : activeView === 'time' ? (granularity === 'hour' ? 'Time by hour of day' : period === 'all' ? 'Time per week' : 'Time per day') : 'Time by person';
  const chartHasData = activeView === 'task' ? topTaskRows.length > 0 : activeView === 'person' ? analytics.personBars.length > 0 : buckets.some((bucket) => bucket.seconds > 0);

  return (
    <section className="timer-analytics" aria-label="Task timer analytics">
      {error && <div className="timer-error" role="alert">{error}</div>}

      <div className="timer-toolbar">
        <div className="timer-segmented" role="group" aria-label="Time period">
          {PERIODS.map((item) => (
            <button type="button" key={item.key} className={period === item.key ? 'is-active' : ''} aria-pressed={period === item.key} onClick={() => setPeriod(item.key)}>{item.label}</button>
          ))}
        </div>
        <div className="timer-toolbar-group">
        <div className="timer-segmented" role="group" aria-label="Group time data by">
          <button type="button" className={granularity === 'day' ? 'is-active' : ''} aria-pressed={granularity === 'day'} onClick={() => setGranularity('day')}>Days</button>
          <button type="button" className={granularity === 'hour' ? 'is-active' : ''} aria-pressed={granularity === 'hour'} onClick={() => setGranularity('hour')}>Hours</button>
        </div>
        {isAdmin && (
          <label className="timer-person-select">
            <span>Person</span>
            <select value={personFilter} onChange={(event) => setPersonFilter(event.target.value)}>
              <option value="all">Everyone</option>
              {personOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
        )}
        </div>
      </div>

      <div className="timer-summary-grid">
        <div className="timer-summary-card"><Clock3 size={18} /><span>Total tracked</span><strong>{formatElapsedSeconds(analytics.totalSeconds)}</strong></div>
        <div className="timer-summary-card"><Activity size={18} /><span>Running now</span><strong>{analytics.activeCount}</strong></div>
        <div className="timer-summary-card"><ListChecks size={18} /><span>Tasks tracked</span><strong>{topTaskRows.length}</strong></div>
        {isAdmin && <div className="timer-summary-card"><Users size={18} /><span>People tracked</span><strong>{new Set(sessions.map((session) => session.user_id)).size}</strong></div>}
      </div>

      <section className="timer-panel">
        <div className="timer-panel-heading">
          <div>
            <h2>{chartTitle}</h2>
            <p>{periodLabel}{selectedPerson ? ` · ${selectedPerson.name}` : isAdmin ? ' · everyone' : ''}</p>
          </div>
          <div className="timer-segmented" role="group" aria-label="Chart view">
            {views.map((view) => (
              <button type="button" key={view.key} className={activeView === view.key ? 'is-active' : ''} aria-pressed={activeView === view.key} onClick={() => setChartView(view.key)}>{view.label}</button>
            ))}
          </div>
        </div>
        {!chartHasData ? <div className="timer-empty">No tracked time for these filters.</div>
          : activeView === 'task' ? <HorizontalBars key={`t-${period}-${personFilter}`} rows={topTaskRows.map((task) => ({ id: task.id, label: task.title, seconds: task.seconds }))} />
          : activeView === 'person' ? <HorizontalBars key={`p-${period}`} rows={analytics.personBars} />
          : <ColumnChart buckets={buckets} />}
      </section>

      <section className="timer-panel">
        <div className="timer-panel-heading"><div><h2>{isAdmin ? 'People and task time' : 'My task time'}</h2><p>{isAdmin ? 'Each assigned person and task has its own timer total. Average completion uses approved tasks.' : 'Your recorded time is listed separately for each assigned task.'} Filtered to: {periodLabel.toLowerCase()}.</p></div>
          <div className="timer-panel-actions">
            <button type="button" className="timer-ghost-btn" onClick={() => setExpandCommand((c) => ({ version: c.version + 1, open: true }))}>Expand all</button>
            <button type="button" className="timer-ghost-btn" onClick={() => setExpandCommand((c) => ({ version: c.version + 1, open: false }))}>Collapse all</button>
          </div>
        </div>
        {loading ? <div className="timer-empty">Loading timer data…</div> : analytics.peopleCards.length ? (
          <div className="timer-person-grid">
            {analytics.peopleCards.map((card) => (
              <PersonCard key={card.person.id} person={card.person} rows={card.rows} averageSeconds={card.averageSeconds} showPerson={isAdmin} defaultOpen={!isAdmin || personFilter !== 'all'} expandCommand={expandCommand} />
            ))}
          </div>
        ) : <div className="timer-empty">No assigned tasks to show.</div>}
      </section>
    </section>
  );
}
