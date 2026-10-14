import React, { useMemo, useState } from 'react';
import { Activity, Clock3, ListChecks, Users } from 'lucide-react';
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
    return { totalSeconds, activeCount, taskRows, personTaskRows, peopleWithAverages: [...personById.values()] };
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
        {isAdmin && analytics.peopleWithAverages.some((person) => person.averageSeconds !== undefined) && (
          <div className="timer-average-list">
            {analytics.peopleWithAverages.filter((person) => person.averageSeconds !== undefined).map((person) => (
              <div className="timer-average-item" key={person.id}><span>{person.full_name || person.email || 'Team member'}</span><span>Average per completed task: <strong>{person.averageSeconds === null ? '—' : formatElapsedSeconds(person.averageSeconds)}</strong></span></div>
            ))}
          </div>
        )}
        {loading ? <div className="timer-empty">Loading timer data…</div> : analytics.personTaskRows.length ? (
          <div className="timer-table-wrap"><table className="timer-table"><thead><tr>{isAdmin && <th>Person</th>}<th>Task</th><th>Status</th><th>Tracked time</th></tr></thead><tbody>
            {analytics.personTaskRows.map((row) => {
              const status = row.active ? 'Running' : row.task.status === 'completed' ? 'Completed' : row.task.status === 'submitted' ? 'Under review' : row.task.status === 'rejected' ? 'Rejected' : (row.task.kanban_column || 'to_do').replaceAll('_', ' ');
              return <tr key={row.id}>{isAdmin && <td>{row.person.full_name || row.person.email || 'Team member'}</td>}<td>{row.task.title}</td><td>{status}</td><td>{formatElapsedSeconds(row.seconds)}</td></tr>;
            })}
          </tbody></table></div>
        ) : <div className="timer-empty">No assigned tasks to show.</div>}
      </section>
    </section>
  );
}
