import React, { useCallback, useMemo, useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { useProjects } from './useProjects';
import ProjectsPanel from './components/ProjectsPanel';
import { useAuth } from './AuthContext';
import { useTasks } from './useTasks';
import { useMeetings } from './useMeetings';
import { useRealtime } from './useRealtime';
import TaskCard from './components/TaskCard';
import TaskDetailModal from './components/TaskDetailModal';
import Navbar from './components/Navbar';
import AiChat from './components/AiChat';
import CalenderView from './components/CalenderView';

function Stat({ label, value, color }) {
  return (
    <div style={{ flex: 1, padding: '17px 18px', borderRight: '1px solid var(--tf-border)', minWidth: 100 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--tf-muted)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 600, color: color || 'var(--tf-text)', letterSpacing: '-0.02em', fontFamily: 'var(--font-display)' }}>{value}</div>
    </div>
  );
}

function Group({ label, tasks, onUpdateStatus, accent, onOpenTaskDetail }) {
  const [open, setOpen] = useState(true);
  if (!tasks.length) return null;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0 0 14px',
        }}
      >
        <span style={{ display: 'block', width: 3, height: 14, background: accent, borderRadius: 2, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tf-muted)' }}>{label}</span>
        <span
          style={{
            fontSize: 11,
            color: 'var(--tf-subhead)',
            background: 'var(--tf-pearl)',
            border: '1px solid var(--tf-border)',
            padding: '2px 9px',
            borderRadius: 999,
          }}
        >
          {tasks.length}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--tf-muted)' }}>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10, marginBottom: 24 }}>
          {tasks.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              onUpdateStatus={onUpdateStatus}
              onOpenDetail={onOpenTaskDetail ? () => onOpenTaskDetail(t) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function EmployeeDashboard() {
  const { profile } = useAuth();
  const { tasks, loading, refetch, updateStatus } = useTasks();
  const { meetings, refetch: refetchMeetings } = useMeetings();
  const { projects, refetch: refetchProjects, createProject, getProgress, loading: projectsLoading } = useProjects();
  const [showAI, setShowAI] = useState(false);
  const [page, setPage] = useState(() => sessionStorage.getItem('taskflow_employee_page') || 'tasks');
  const [filters, setFilters] = useState({ search: '', type: '', assignee_id: '' });
  const [detailTask, setDetailTask] = useState(null);

  const profileById = useMemo(() => {
    const m = {};
    if (profile?.id) m[profile.id] = profile.full_name || profile.email;
    return m;
  }, [profile]);

  React.useEffect(() => {
    sessionStorage.setItem('taskflow_employee_page', page);
  }, [page]);

  useRealtime('tasks', useCallback(() => refetch(), [refetch]));
  useRealtime('meetings', useCallback(() => refetchMeetings(), [refetchMeetings]));

  const today = new Date().toISOString().split('T')[0];

  const groups = useMemo(() => ({
    overdue:    tasks.filter((t) => t.due_date && t.due_date < today && t.status !== 'completed'),
    blocked:    tasks.filter((t) => t.status === 'blocked'),
    inProgress: tasks.filter((t) => t.status === 'in_progress'),
    pending:    tasks.filter((t) => t.status === 'pending' && !(t.due_date && t.due_date < today)),
    completed:  tasks.filter((t) => t.status === 'completed'),
  }), [tasks, today]);

  const stats = {
    total:     tasks.length,
    pending:   groups.pending.length,
    completed: groups.completed.length,
    overdue:   groups.overdue.length,
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--tf-page)', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <div style={{ flex: 1, maxWidth: 920, width: '100%', margin: '0 auto', padding: '28px 24px' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 600, color: 'var(--tf-text)', letterSpacing: '-0.02em', fontFamily: 'var(--font-display)' }}>
              {greeting()}, {profile?.full_name?.split(' ')[0] || 'there'}
            </h1>
            <div style={{ fontSize: 15, color: 'var(--tf-muted)', marginTop: 4 }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              {stats.overdue > 0 && <span style={{ color: 'var(--status-danger)', marginLeft: 10 }}>{stats.overdue} overdue</span>}
            </div>
          </div>
          <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={refetch} aria-label="Refresh">
            <RefreshCw size={15} strokeWidth={1.8} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <button className={`btn btn-sm ${page === 'tasks' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPage('tasks')}>
            Tasks
          </button>
          <button className={`btn btn-sm ${page === 'calender' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPage('calender')}>
            Calender
          </button>
          <button className={`btn btn-sm ${page === 'projects' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPage('projects')}>
            Projects
          </button>
        </div>

        {/* Stats */}
        <div className="tf-stat-row" style={{ border: '1px solid var(--tf-border)', borderRadius: 18, display: 'flex', background: 'var(--tf-panel)', marginBottom: 28, overflow: 'hidden', boxShadow: 'none' }}>
          <Stat label="Total" value={stats.total} />
          <Stat label="Pending" value={stats.pending} color="var(--status-warning)" />
          <Stat label="Completed" value={stats.completed} color="var(--status-success)" />
          <Stat label="Overdue" value={stats.overdue} color={stats.overdue > 0 ? 'var(--status-danger)' : 'var(--tf-text)'} />
        </div>

        {/* Overdue alert */}
        {stats.overdue > 0 && (
          <div style={{ background: 'rgba(248,113,113,0.04)', border: '1px solid rgba(248,113,113,0.15)', borderRadius: 5, padding: '10px 14px', marginBottom: 22 }}>
            <span style={{ fontSize: 14, color: 'var(--status-danger)', lineHeight: 1.5 }}>
              {stats.overdue} task{stats.overdue !== 1 ? 's are' : ' is'} overdue. Update the status or contact your admin.
            </span>
          </div>
        )}

        {/* Tasks */}
        {page === 'tasks' && (loading
          ? <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><span className="spinner" style={{ width: 20, height: 20 }} /></div>
          : tasks.length === 0
            ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--tf-muted)' }}>
                <div style={{ fontSize: 13 }}>No tasks assigned to you yet.</div>
              </div>
            ) : (
              <div>
                <Group label="Overdue" tasks={groups.overdue} onUpdateStatus={updateStatus} accent="var(--status-danger)" onOpenTaskDetail={setDetailTask} />
                <Group label="Blocked" tasks={groups.blocked} onUpdateStatus={updateStatus} accent="var(--status-danger)" onOpenTaskDetail={setDetailTask} />
                <Group label="In Progress" tasks={groups.inProgress} onUpdateStatus={updateStatus} accent="var(--color-primary)" onOpenTaskDetail={setDetailTask} />
                <Group label="Pending" tasks={groups.pending} onUpdateStatus={updateStatus} accent="var(--status-warning)" onOpenTaskDetail={setDetailTask} />
                <Group label="Completed" tasks={groups.completed} onUpdateStatus={updateStatus} accent="var(--status-success)" onOpenTaskDetail={setDetailTask} />
              </div>
            )
        )}

        {page === 'calender' && (
          <CalenderView
            tasks={tasks}
            meetings={meetings}
            filters={filters}
            onFiltersChange={setFilters}
            assignees={[]}
            includeEmployeeFilter={false}
          />
        )}

        {page === 'projects' && (
          <ProjectsPanel
            projects={projects}
            loading={projectsLoading}
            createProject={createProject}
            getProgress={getProgress}
            onRefresh={refetchProjects}
            canCreate={false}
          />
        )}
      </div>

      {/* Floating AI button */}
      {!showAI && (
        <button type="button" className="tf-fab" onClick={() => setShowAI(true)} title="AI Assistant">
          <Sparkles size={20} color="#ffffff" strokeWidth={1.8} />
        </button>
      )}

      {showAI && <AiChat onClose={() => setShowAI(false)} />}

      <TaskDetailModal
        open={!!detailTask}
        task={detailTask}
        isAdmin={false}
        profileById={profileById}
        onClose={() => setDetailTask(null)}
      />
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
