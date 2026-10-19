import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Sparkles } from 'lucide-react';
import api from './api';
import { useProjects } from './useProjects';
import ProjectsPanel from './components/ProjectsPanel';
import TaskForm from './components/TaskForm';
import MeetingForm from './components/MeetingForm';
import { useAuth } from './AuthContext';
import { ThemeToggle } from './ThemeContext';
import { useTasks } from './useTasks';
import { useMeetings } from './useMeetings';
import { useRealtime, useLiveRefresh } from './useRealtime';
import AiFab from './components/AiFab';
import TaskCard from './components/TaskCard';
import TaskDetailModal from './components/TaskDetailModal';
import MeetingDetailModal from './components/MeetingDetailModal';
import Sidebar from './components/Sidebar';
import KanbanBoard from './components/KanbanBoard';
import TimerAnalytics from './components/TimerAnalytics';
import { useTaskTimers } from './useTaskTimers';
import AiChat from './components/AiChat';
import CalenderView from './components/CalenderView';
import NotificationSettings from './components/NotificationSettings';
import ProfilePage from './components/ProfilePage';
import ChatPage from './components/ChatPage';
import FileExplorer from './components/FileExplorer';
import { lazy, Suspense } from 'react';
const WhiteboardPage = lazy(() => import('./components/WhiteboardPage'));

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

function Group({ label, tasks, onUpdateStatus, onSubmitTask, accent, onOpenTaskDetail }) {
  const [open, setOpen] = useState(true);
  if (!tasks.length) return null;
  const sectionKey = label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className={`employee-task-group employee-task-group-${sectionKey}`}>
      <button
        type="button"
        className="employee-task-group-toggle"
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
        <div className="employee-task-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10, marginBottom: 24 }}>
          {tasks.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              onUpdateStatus={onUpdateStatus}
              onSubmit={onSubmitTask}
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
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const selfAssigneePreset = profile?.id ? [profile.id] : [];
  const { tasks, loading, refetch, updateStatus, moveTaskBoard, createTask, updateTask, submitTask, approveTask, requestTaskChanges, getTaskHistory } = useTasks();
  const { meetings, refetch: refetchMeetings, createMeeting, updateMeeting, updateStatus: updateMeetingStatus, submitMeeting, approveMeeting, requestMeetingChanges, getMeetingHistory } = useMeetings();
  const { projects, refetch: refetchProjects, createProject, getProgress, loading: projectsLoading } = useProjects();
  const taskTimers = useTaskTimers();
  const refreshTimers = taskTimers.refetch;
  const [showAI, setShowAI] = useState(false);
  const routeSegment = pathname.split('/').filter(Boolean).at(-1);
  const page = routeSegment === 'calendar' ? 'calender' : routeSegment;
  const validPages = ['tasks', 'kanban', 'timer', 'calender', 'projects', 'chat', 'files', 'whiteboard', 'notifications', 'profile'];
  const [filters, setFilters] = useState({ search: '', type: '', assignee_id: '' });
  const [detailTask, setDetailTask] = useState(null);
  const [detailMeeting, setDetailMeeting] = useState(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [taskFormKey, setTaskFormKey] = useState(0);
  const [meetingFormKey, setMeetingFormKey] = useState(0);
  const [taskFormCtx, setTaskFormCtx] = useState({ projectId: '', parentTaskId: '' });
  const [meetingFormCtx, setMeetingFormCtx] = useState({ projectId: '', parentMeetingId: '' });
  const [allProfiles, setAllProfiles] = useState([]);

  useEffect(() => {
    if (!profile?.id) return;
    api
      .get('/auth/profiles')
      .then(({ data }) => setAllProfiles(data || []))
      .catch(() => setAllProfiles([]));
  }, [profile?.id]);

  const profileById = useMemo(() => {
    const m = {};
    (allProfiles || []).forEach((p) => {
      m[p.id] = p.full_name || p.email;
    });
    if (profile?.id && !m[profile.id]) m[profile.id] = profile.full_name || profile.email;
    return m;
  }, [allProfiles, profile]);

  useEffect(() => {
    if (!validPages.includes(page)) navigate('/dashboard/tasks', { replace: true });
  }, [page, navigate]);

  function navigateToPage(nextPage) {
    const segment = nextPage === 'calender' ? 'calendar' : nextPage;
    navigate(`/dashboard/${segment}`);
  }

  function launchTaskForm(ctx = {}) {
    setTaskFormCtx({ projectId: ctx.projectId || '', parentTaskId: ctx.parentTaskId || '' });
    setTaskFormKey((k) => k + 1);
    setShowTaskForm(true);
  }

  function launchMeetingForm(ctx = {}) {
    setMeetingFormCtx({ projectId: ctx.projectId || '', parentMeetingId: ctx.parentMeetingId || '' });
    setMeetingFormKey((k) => k + 1);
    setShowMeetingForm(true);
  }

  useRealtime('tasks', useCallback(() => refetch({ silent: true }), [refetch]));
  useRealtime('meetings', useCallback(() => refetchMeetings(), [refetchMeetings]));
  useRealtime('task_assignees', useCallback(() => refetch({ silent: true }), [refetch]));
  useLiveRefresh(useCallback(() => { void refetch({ silent: true }); void refetchProjects({ silent: true }); void refreshTimers?.(); }, [refetch, refetchProjects, refreshTimers]));
  useRealtime('meeting_assignees', useCallback(() => refetchMeetings(), [refetchMeetings]));

  const today = new Date().toISOString().split('T')[0];

  const groups = useMemo(() => ({
    overdue: tasks.filter((t) => t.due_date && t.due_date < today && t.status !== 'completed'),
    blocked: tasks.filter((t) => t.status === 'blocked'),
    inProgress: tasks.filter((t) => t.status === 'in_progress' || t.status === 'rejected'),
    pending: tasks.filter((t) => t.status === 'pending' && !(t.due_date && t.due_date < today)),
    completed: tasks.filter((t) => t.status === 'completed'),
  }), [tasks, today]);

  const stats = {
    total: tasks.length,
    pending: groups.pending.length,
    completed: groups.completed.length,
    overdue: groups.overdue.length,
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--tf-page)', display: 'flex' }}>
      <Sidebar active={page} onNav={navigateToPage} role="employee" />
      <main style={{ flex: 1, minWidth: 0 }}>
      <div className="employee-dashboard-content" style={{ width: '100%', minWidth: 0, padding: '24px' }}>
        <div className="employee-page-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 600, color: 'var(--tf-text)', letterSpacing: '-0.02em', fontFamily: 'var(--font-display)' }}>
              {page === 'tasks' ? (
                <span className="employee-greeting-lines">
                  <span>{greeting()},</span>
                  <span>{profile?.full_name?.split(' ')[0] || 'there'}</span>
                </span>
              ) : page === 'kanban' ? 'Kanban Board' : page === 'timer' ? 'Timer Analytics' : page === 'calender' ? 'Calendar' : page === 'projects' ? 'Projects' : page === 'chat' ? 'Chat' : page === 'files' ? 'Files' : page === 'whiteboard' ? 'Whiteboard' : page === 'profile' ? 'Profile' : 'Notifications'}
            </h1>
            <div style={{ fontSize: 15, color: 'var(--tf-muted)', marginTop: 4 }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              {stats.overdue > 0 && <span style={{ color: 'var(--status-danger)', marginLeft: 10 }}>{stats.overdue} overdue</span>}
            </div>
          </div>
          <div className="employee-header-actions">
            <button type="button" className="btn btn-ghost btn-sm btn-icon tf-header-ai-button" onClick={() => setShowAI(true)} aria-label="Open AI Assistant" title="AI Assistant">
              <Sparkles size={20} strokeWidth={2.2} />
            </button>
            <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={refetch} aria-label="Refresh">
              <RefreshCw size={20} strokeWidth={2} />
            </button>
            <ThemeToggle size={16} />
          </div>
        </div>

        {page !== 'profile' && page !== 'chat' && page !== 'files' && page !== 'whiteboard' && page !== 'kanban' && <div className="tf-dashboard-actions" style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' }}>
          <span style={{ display: page === 'notifications' ? 'none' : 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" type="button" onClick={() => launchTaskForm()}>
              <Plus size={14} /> Task
            </button>
            <button className="btn btn-primary btn-sm" type="button" onClick={() => launchMeetingForm()}>
              <Plus size={14} /> Meeting
            </button>
          </span>
        </div>}

        {page === 'profile' && <ProfilePage />}
        {page === 'chat' && <ChatPage />}
        {page === 'files' && <FileExplorer />}
        {page === 'whiteboard' && <Suspense fallback={<div className="spinner" style={{ width: 22, height: 22 }} />}><WhiteboardPage /></Suspense>}

        {page !== 'notifications' && page !== 'timer' && page !== 'profile' && page !== 'chat' && page !== 'files' && page !== 'whiteboard' && (
        <div className="tf-stat-row" style={{ border: '1px solid var(--tf-border)', borderRadius: 18, display: 'flex', background: 'var(--tf-panel)', marginBottom: 28, overflow: 'hidden', boxShadow: 'none' }}>
          <Stat label="Total" value={stats.total} />
          <Stat label="Pending" value={stats.pending} color="var(--status-warning)" />
          <Stat label="Completed" value={stats.completed} color="var(--status-success)" />
          <Stat label="Overdue" value={stats.overdue} color={stats.overdue > 0 ? 'var(--status-danger)' : 'var(--tf-text)'} />
        </div>
        )}

        {page !== 'notifications' && page !== 'timer' && page !== 'profile' && page !== 'chat' && page !== 'files' && page !== 'whiteboard' && stats.overdue > 0 && (
          <div style={{ background: 'rgba(248,113,113,0.04)', border: '1px solid rgba(248,113,113,0.15)', borderRadius: 5, padding: '10px 14px', marginBottom: 22 }}>
            <span style={{ fontSize: 14, color: 'var(--status-danger)', lineHeight: 1.5 }}>
              {stats.overdue} task{stats.overdue !== 1 ? 's are' : ' is'} overdue.
            </span>
          </div>
        )}

        {page === 'notifications' && (
          <div
            style={{
              border: '1px solid var(--tf-border)',
              borderRadius: 18,
              background: 'var(--tf-panel)',
              padding: '24px 28px',
            }}
          >
            <NotificationSettings />
          </div>
        )}

        {page === 'kanban' && (
          <KanbanBoard
            actions={<div className="kanban-task-actions">
              <button className="btn btn-primary btn-sm" type="button" onClick={() => launchTaskForm()}><Plus size={14} /> Task</button>
              <button className="btn btn-primary btn-sm" type="button" onClick={() => launchMeetingForm()}><Plus size={14} /> Meeting</button>
            </div>}
            tasks={tasks}
            projects={projects}
            assignees={allProfiles}
            profileById={profileById}
            isAdmin={false}
            loading={loading}
            onMoveTask={moveTaskBoard}
            onOpenTask={setDetailTask}
            timerSessions={taskTimers.sessions}
            currentUserId={profile?.id}
            onStartTimer={taskTimers.start}
            onPauseTimer={taskTimers.pause}
            timerError={taskTimers.error}
          />
        )}

        {page === 'timer' && (
          <TimerAnalytics tasks={tasks} sessions={taskTimers.sessions} people={taskTimers.people} directoryProfiles={allProfiles} profile={profile} isAdmin={false} loading={taskTimers.loading} error={taskTimers.error} />
        )}

        {page === 'tasks'
          && (loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
              <span className="spinner" style={{ width: 20, height: 20 }} />
            </div>
          ) : tasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--tf-muted)' }}>
              <div style={{ fontSize: 15, marginBottom: 8 }}>No tasks assigned to you yet.</div>
              <div style={{ fontSize: 13 }}>Create one with “Task”, or assign yourself plus teammates or admins.</div>
            </div>
          ) : (
            <div>
              <Group label="Overdue" tasks={groups.overdue} onUpdateStatus={updateStatus} onSubmitTask={submitTask} accent="var(--status-danger)" onOpenTaskDetail={setDetailTask} />
              <Group label="Blocked" tasks={groups.blocked} onUpdateStatus={updateStatus} onSubmitTask={submitTask} accent="var(--status-danger)" onOpenTaskDetail={setDetailTask} />
              <Group label="In Progress" tasks={groups.inProgress} onUpdateStatus={updateStatus} onSubmitTask={submitTask} accent="var(--color-primary)" onOpenTaskDetail={setDetailTask} />
              <Group label="Pending" tasks={groups.pending} onUpdateStatus={updateStatus} onSubmitTask={submitTask} accent="var(--status-warning)" onOpenTaskDetail={setDetailTask} />
              <Group label="Completed" tasks={groups.completed} onUpdateStatus={updateStatus} onSubmitTask={submitTask} accent="var(--status-success)" onOpenTaskDetail={setDetailTask} />
            </div>
          ))}

        {page === 'calender' && (
          <CalenderView
            tasks={tasks}
            meetings={meetings}
            filters={filters}
            onFiltersChange={setFilters}
            assignees={allProfiles}
            includeEmployeeFilter
            onSelectEvent={(payload) => {
              if (payload?.kind === 'task') setDetailTask(payload.row);
              if (payload?.kind === 'meeting') setDetailMeeting(payload.row);
            }}
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
            tasks={tasks}
            meetings={meetings}
            profileById={profileById}
            onAddTaskForProject={(projectId) => launchTaskForm({ projectId })}
            onAddMeetingForProject={(projectId) => launchMeetingForm({ projectId })}
            onOpenTask={(t) => setDetailTask(t)}
            onOpenMeeting={(m) => setDetailMeeting(m)}
            onUpdateTaskStatus={updateStatus}
            onUpdateMeetingStatus={updateMeetingStatus}
          />
        )}
      </div>
      </main>

      {!showAI && <AiFab onOpen={() => setShowAI(true)} />}

      {showAI && <AiChat onClose={() => setShowAI(false)} />}

      <TaskDetailModal
        open={!!detailTask}
        task={detailTask}
        isAdmin={false}
        profile={profile}
        projects={projects}
        profileById={profileById}
        updateTask={updateTask}
        submitTask={submitTask}
        approveTask={approveTask}
        requestTaskChanges={requestTaskChanges}
        getTaskHistory={getTaskHistory}
        onTasksChanged={() => refetch({ silent: true })}
        refreshSignal={tasks.length}
        onClose={() => setDetailTask(null)}
        onNavigateTask={(t) => setDetailTask(t)}
        onAddSubtask={(parentId, ctx = {}) =>
          launchTaskForm({ parentTaskId: parentId, projectId: ctx.projectId || '' })
        }
      />
      <MeetingDetailModal
        open={!!detailMeeting}
        meeting={detailMeeting}
        isAdmin={false}
        profile={profile}
        projects={projects}
        profileById={profileById}
        updateMeeting={updateMeeting}
        submitMeeting={submitMeeting}
        approveMeeting={approveMeeting}
        requestMeetingChanges={requestMeetingChanges}
        getMeetingHistory={getMeetingHistory}
        onClose={() => setDetailMeeting(null)}
        onNavigateMeeting={(m) => setDetailMeeting(m)}
        onAddSubmeeting={(parentId, ctx = {}) =>
          launchMeetingForm({ parentMeetingId: parentId, projectId: ctx.projectId || '' })
        }
      />

      {/* Render create forms after detail modals so stacked overlays receive clicks (same z-index). */}
      {showTaskForm && (
        <TaskForm
          key={taskFormKey}
          projects={projects}
          defaultProjectId={taskFormCtx.projectId}
          parentTaskId={taskFormCtx.parentTaskId}
          parentOptions={tasks}
          initialAssigneeIds={selfAssigneePreset}
          onSubmit={createTask}
          onClose={() => {
            setShowTaskForm(false);
            setTaskFormCtx({ projectId: '', parentTaskId: '' });
          }}
        />
      )}
      {showMeetingForm && (
        <MeetingForm
          key={meetingFormKey}
          projects={projects}
          defaultProjectId={meetingFormCtx.projectId}
          parentMeetingId={meetingFormCtx.parentMeetingId}
          initialAssigneeIds={selfAssigneePreset}
          existingMeetings={meetings}
          onSubmit={createMeeting}
          onClose={() => {
            setShowMeetingForm(false);
            setMeetingFormCtx({ projectId: '', parentMeetingId: '' });
          }}
        />
      )}
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
