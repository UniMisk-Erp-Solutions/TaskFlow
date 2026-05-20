import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Plus, Sparkles, Send, RefreshCw, Upload } from 'lucide-react';
import CsvImportModal from './components/CsvImportModal';
import { useAuth } from './AuthContext';
import { useTasks } from './useTasks';
import { useMeetings } from './useMeetings';
import { useRealtime } from './useRealtime';
import Sidebar from './components/Sidebar';
import TaskTable from './components/TaskTable';
import TaskForm from './components/TaskForm';
import UserManagement from './components/UserManagement';
import MeetingForm from './components/MeetingForm';
import MeetingTable from './components/MeetingTable';
import CalenderView from './components/CalenderView';
import AiChat from './components/AiChat';
import FilterBar from './components/FilterBar';
import OverviewUnified from './components/OverviewUnified';
import TaskDetailModal from './components/TaskDetailModal';
import MeetingDetailModal from './components/MeetingDetailModal';
import ProjectsPanel from './components/ProjectsPanel';
import NotificationSettings from './components/NotificationSettings';
import { useProjects } from './useProjects';
import api from './api';

const FILTERS_DEFAULT = { search: '', status: '', priority: '', type: '', assignee_id: '' };

function matchesAssigneeFilter(item, assigneeFilter) {
  if (!assigneeFilter) return true;
  const ids = item.assignee_ids?.length
    ? item.assignee_ids
    : item.assignee_id
      ? [item.assignee_id]
      : [];
  return ids.includes(assigneeFilter);
}

function MiniStat({ label, value }) {
  return (
    <div className="tf-stat-mini">
      <div
        style={{
          fontSize: 11,
          color: 'var(--tf-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 600, color: 'var(--tf-text)', marginTop: 8, letterSpacing: '-0.02em' }}>{value ?? 0}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const { profile } = useAuth();
  const { tasks, loading, refetch, createTask, updateStatus, deleteTask, updateTask, submitTask, approveTask, requestTaskChanges, getTaskHistory } = useTasks();
  const {
    meetings,
    loading: meetingsLoading,
    refetch: refetchMeetings,
    createMeeting,
    updateStatus: updateMeetingStatus,
    deleteMeeting,
    updateMeeting,
    submitMeeting,
    approveMeeting,
    requestMeetingChanges,
    getMeetingHistory,
  } = useMeetings();

  const { projects, refetch: refetchProjects, createProject, getProgress, loading: projectsLoading } = useProjects();

  const [page,     setPage]     = useState(() => sessionStorage.getItem('taskflow_admin_page') || 'overview');
  const [showForm, setShowForm] = useState(false);
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [taskFormKey, setTaskFormKey] = useState(0);
  const [meetingFormKey, setMeetingFormKey] = useState(0);
  const [taskFormCtx, setTaskFormCtx] = useState({ projectId: '', parentTaskId: '' });
  const [meetingFormCtx, setMeetingFormCtx] = useState({ projectId: '', parentMeetingId: '' });
  const [showAI,   setShowAI]   = useState(false);
  const [importKind, setImportKind] = useState(null); // 'task' | 'meeting' | null
  const [filters,  setFilters]  = useState(FILTERS_DEFAULT);
  const [allProfiles, setAllProfiles] = useState([]);
  const [overviewStats, setOverviewStats] = useState(null);
  const [sending,  setSending]  = useState(false);
  const [sendMsg,  setSendMsg]  = useState('');
  const [detailTask, setDetailTask] = useState(null);
  const [detailMeeting, setDetailMeeting] = useState(null);

  const profileById = useMemo(() => {
    const m = {};
    if (profile?.id) m[profile.id] = profile.full_name || profile.email;
    (allProfiles || []).forEach((p) => {
      m[p.id] = p.full_name || p.email;
    });
    return m;
  }, [profile, allProfiles]);

  useEffect(() => {
    sessionStorage.setItem('taskflow_admin_page', page);
  }, [page]);

  function launchTaskForm(ctx = {}) {
    setTaskFormCtx({ projectId: ctx.projectId || '', parentTaskId: ctx.parentTaskId || '' });
    setTaskFormKey((k) => k + 1);
    setShowForm(true);
  }

  function launchMeetingForm(ctx = {}) {
    setMeetingFormCtx({ projectId: ctx.projectId || '', parentMeetingId: ctx.parentMeetingId || '' });
    setMeetingFormKey((k) => k + 1);
    setShowMeetingForm(true);
  }

  useRealtime('tasks', useCallback(() => refetch(), [refetch]));
  useRealtime('meetings', useCallback(() => refetchMeetings(), [refetchMeetings]));
  useRealtime('task_assignees', useCallback(() => refetch(), [refetch]));
  useRealtime('meeting_assignees', useCallback(() => refetchMeetings(), [refetchMeetings]));

  useEffect(() => {
    if (!profile?.id) return;
    api
      .get('/auth/profiles')
      .then(({ data }) => {
        const list = data || [];
        setAllProfiles(list);
      })
      .catch(() => {
        setAllProfiles([]);
      });
  }, [profile?.id]);

  useEffect(() => {
    if (page !== 'overview' || !profile?.id) return;
    api
      .get('/admin/overview-stats')
      .then(({ data }) => setOverviewStats(data))
      .catch(() => setOverviewStats(null));
  }, [page, profile?.id, tasks, meetings]);

  async function handleSendReminders() {
    setSending(true); setSendMsg('');
    try {
      const { data } = await api.post('/admin/send-reminders');
      setSendMsg(`${data.sent} reminder${data.sent !== 1 ? 's' : ''} sent`);
    } catch (err) {
      setSendMsg(`Failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setSending(false);
      setTimeout(() => setSendMsg(''), 6000);
    }
  }

  // Search matches across title, description, AND project name so admins can
  // pull up everything tied to a project without having to know exact titles.
  function matchesQuery(row, q) {
    if (!q) return true;
    const hay = `${row.title || ''} ${row.description || ''} ${row.project_name || ''}`.toLowerCase();
    return hay.includes(q);
  }

  const filtered = tasks.filter((t) => {
    const q = filters.search.toLowerCase();
    if (!matchesQuery(t, q)) return false;
    if (filters.status   && t.status   !== filters.status)   return false;
    if (filters.priority && t.priority !== filters.priority) return false;
    if (filters.assignee_id && !matchesAssigneeFilter(t, filters.assignee_id)) return false;
    return true;
  });
  const filteredMeetings = meetings.filter((m) => {
    const q = filters.search.toLowerCase();
    if (!matchesQuery(m, q)) return false;
    if (filters.status && m.status !== filters.status) return false;
    if (filters.priority && m.priority !== filters.priority) return false;
    if (filters.assignee_id && !matchesAssigneeFilter(m, filters.assignee_id)) return false;
    return true;
  });

  // Overview-only view: hide completed items so the panel highlights what's
  // still active. The dedicated Tasks page (page === 'tasks') keeps the full
  // list including completed.
  const overviewTasks = filtered.filter((t) => t.status !== 'completed');
  const overviewMeetings = filteredMeetings.filter((m) => m.status !== 'completed');

  const showTaskLists = filters.type !== 'meeting';
  const showMeetingLists = filters.type !== 'task';

  const today = new Date().toISOString().split('T')[0];
  const overdue = tasks.filter((t) => t.due_date && t.due_date < today && t.status !== 'completed');

  // Review queue — anything an admin must act on.
  const submittedTasks = tasks.filter((t) => t.status === 'submitted');
  const submittedMeetings = meetings.filter((m) => m.status === 'submitted');
  const pendingApprovalCount = submittedTasks.length + submittedMeetings.length;

  // Inline review handlers — passed to TaskTable / MeetingTable / OverviewUnified so
  // an admin can approve / request changes / reopen without opening the detail modal.
  async function handleApproveTaskInline(t) {
    try { await approveTask(t.id, ''); }
    catch (err) { window.alert(err.response?.data?.error || err.message); }
  }
  async function handleRequestChangesTaskInline(t) {
    const note = window.prompt(`Request changes on "${t.title}". What needs to change?`, '');
    if (note === null) return;
    if (!note.trim()) { window.alert('A note is required when requesting changes.'); return; }
    try { await requestTaskChanges(t.id, note.trim()); }
    catch (err) { window.alert(err.response?.data?.error || err.message); }
  }
  async function handleReopenTaskInline(t) {
    const note = window.prompt(`Reopen "${t.title}". Reason (optional):`, '');
    if (note === null) return;
    try { await requestTaskChanges(t.id, note.trim() || 'Reopened by admin'); }
    catch (err) { window.alert(err.response?.data?.error || err.message); }
  }
  async function handleApproveMeetingInline(m) {
    try { await approveMeeting(m.id, ''); }
    catch (err) { window.alert(err.response?.data?.error || err.message); }
  }
  async function handleRequestChangesMeetingInline(m) {
    const note = window.prompt(`Request changes on "${m.title}". What needs to change?`, '');
    if (note === null) return;
    if (!note.trim()) { window.alert('A note is required when requesting changes.'); return; }
    try { await requestMeetingChanges(m.id, note.trim()); }
    catch (err) { window.alert(err.response?.data?.error || err.message); }
  }
  async function handleReopenMeetingInline(m) {
    const note = window.prompt(`Reopen "${m.title}". Reason (optional):`, '');
    if (note === null) return;
    try { await requestMeetingChanges(m.id, note.trim() || 'Reopened by admin'); }
    catch (err) { window.alert(err.response?.data?.error || err.message); }
  }

  function openReviewQueue() {
    setFilters({ ...FILTERS_DEFAULT, status: 'submitted' });
    setPage('tasks');
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--tf-page)' }}>
      <Sidebar active={page} onNav={setPage} />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div className="tf-subnav">
          <div>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 21,
                fontWeight: 600,
                letterSpacing: '-0.015em',
                color: 'var(--tf-text)',
              }}
            >
              {page === 'overview'
                ? `Good ${hour()}, ${profile?.full_name?.split(' ')[0] || 'Admin'}`
                : page === 'tasks'
                  ? 'All Tasks'
                  : page === 'calender'
                    ? 'Calender View'
                    : page === 'projects'
                      ? 'Projects'
                      : page === 'users'
                        ? 'User Management'
                        : page === 'notifications'
                          ? 'Notifications'
                          : 'Reminders'}
            </span>
            {page === 'overview' && (
              <span style={{ fontSize: 15, color: 'var(--tf-muted)', marginLeft: 12, fontWeight: 400 }}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {pendingApprovalCount > 0 && (
              <button
                type="button"
                onClick={openReviewQueue}
                title={`${pendingApprovalCount} item${pendingApprovalCount !== 1 ? 's' : ''} pending approval`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'var(--status-warning-bg)',
                  border: '1px solid rgba(221,91,0,0.30)',
                  color: 'var(--status-warning)',
                  padding: '5px 10px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  letterSpacing: '0.02em',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: 'var(--status-warning)',
                    boxShadow: '0 0 0 3px rgba(221,91,0,0.18)',
                  }}
                />
                Review · {pendingApprovalCount}
              </button>
            )}
            {sendMsg && page === 'email' && (
              <span style={{ fontSize: 14, color: sendMsg.startsWith('Failed') ? 'var(--status-danger)' : 'var(--status-success)' }}>{sendMsg}</span>
            )}
            {page !== 'notifications' && page !== 'users' && (
              <>
                <button className="btn btn-ghost btn-sm" onClick={handleSendReminders} disabled={sending}>
                  {sending ? <span className="spinner" /> : <Send size={12} />}
                  Send Reminders
                </button>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setShowAI(true)} title="AI Assistant">
                  <Sparkles size={13} />
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  title="Bulk import tasks from a CSV"
                  onClick={() => setImportKind('task')}
                >
                  <Upload size={13} /> Import tasks
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  title="Bulk import meetings from a CSV"
                  onClick={() => setImportKind('meeting')}
                >
                  <Upload size={13} /> Import meetings
                </button>
                <button className="btn btn-primary btn-sm" type="button" onClick={() => launchTaskForm()}>
                  <Plus size={13} /> New Task
                </button>
                <button className="btn btn-primary btn-sm" type="button" onClick={() => launchMeetingForm()}>
                  <Plus size={13} /> New Meeting
                </button>
              </>
            )}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

          {/* ── OVERVIEW ── */}
          {page === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))',
                  gap: 10,
                }}
              >
                <MiniStat label="Pending approval" value={pendingApprovalCount} />
                <MiniStat label="Pending tasks" value={overviewStats?.pending_tasks} />
                <MiniStat label="Pending meetings" value={overviewStats?.pending_meetings} />
                <MiniStat label="Completed tasks" value={overviewStats?.completed_tasks} />
                <MiniStat label="Completed meetings" value={overviewStats?.completed_meetings} />
                <MiniStat label="Overdue tasks" value={overviewStats?.overdue_tasks} />
                <MiniStat label="Overdue meetings" value={overviewStats?.overdue_meetings} />
                <MiniStat label="Team members" value={overviewStats?.total_users} />
              </div>

              {pendingApprovalCount > 0 && (
                <div
                  style={{
                    background: 'var(--status-warning-bg)',
                    border: '1px solid rgba(221,91,0,0.25)',
                    borderRadius: 12,
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--status-warning)',
                        background: 'rgba(221,91,0,0.10)',
                        padding: '3px 9px',
                        borderRadius: 999,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                      }}
                    >
                      Review queue
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--tf-text)' }}>
                      <strong>{pendingApprovalCount}</strong> item{pendingApprovalCount !== 1 ? 's' : ''} waiting
                      for your approval
                      {submittedTasks.length > 0 && submittedMeetings.length > 0
                        ? ` (${submittedTasks.length} task${submittedTasks.length !== 1 ? 's' : ''}, ${submittedMeetings.length} meeting${submittedMeetings.length !== 1 ? 's' : ''})`
                        : submittedTasks.length > 0
                          ? ` (${submittedTasks.length} task${submittedTasks.length !== 1 ? 's' : ''})`
                          : ` (${submittedMeetings.length} meeting${submittedMeetings.length !== 1 ? 's' : ''})`}
                    </span>
                  </div>
                  <button className="btn btn-primary btn-sm" type="button" onClick={openReviewQueue}>
                    Open review queue
                  </button>
                </div>
              )}

              <div style={{ border: '1px solid var(--tf-border)', borderRadius: 18, overflow: 'hidden', background: 'var(--tf-panel)' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--tf-border)' }}>
                  <FilterBar
                    filters={filters}
                    onChange={setFilters}
                    onClear={() => setFilters(FILTERS_DEFAULT)}
                    includeType
                    includeAssignee
                    assignees={allProfiles}
                    searchPlaceholder="Search tasks and meetings"
                  />
                </div>
              </div>

              {overdue.length > 0 && (
                <div
                  style={{
                    background: 'rgba(248,113,113,0.04)',
                    border: '1px solid rgba(248,113,113,0.15)',
                    borderRadius: 6,
                    padding: '11px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: 13, color: 'var(--status-danger)' }}>
                    {overdue.length} task{overdue.length !== 1 ? 's' : ''} past due date
                  </span>
                  <button className="btn btn-ghost btn-sm" type="button" onClick={() => setPage('tasks')}>
                    View tasks
                  </button>
                </div>
              )}

              <div style={{ border: '1px solid var(--tf-border)', borderRadius: 18, overflow: 'hidden', background: 'var(--tf-panel)' }}>
                <div
                  style={{
                    padding: '13px 16px',
                    borderBottom: '1px solid var(--tf-border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--tf-muted)',
                      letterSpacing: '0.3px',
                      textTransform: 'uppercase',
                    }}
                  >
                    Tasks &amp; meetings
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-ghost btn-sm btn-icon" type="button" onClick={() => { refetch(); refetchMeetings(); }}>
                      <RefreshCw size={12} />
                    </button>
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => setPage('tasks')}>
                      Open full lists
                    </button>
                  </div>
                </div>
                {!showTaskLists && !showMeetingLists ? (
                  <div className="empty">
                    <div style={{ fontSize: 13, color: 'var(--tf-subhead)' }}>Both lists hidden by type filter</div>
                  </div>
                ) : (
                  <OverviewUnified
                    tasks={showTaskLists ? overviewTasks : []}
                    meetings={showMeetingLists ? overviewMeetings : []}
                    loading={(showTaskLists && loading) || (showMeetingLists && meetingsLoading)}
                    meetingsLoading={false}
                    profileById={profileById}
                    onDeleteTask={deleteTask}
                    onUpdateTaskStatus={updateStatus}
                    onDeleteMeeting={deleteMeeting}
                    onUpdateMeetingStatus={updateMeetingStatus}
                    onOpenTaskDetail={setDetailTask}
                    onOpenMeetingDetail={setDetailMeeting}
                    onApproveTask={handleApproveTaskInline}
                    onRequestChangesTask={handleRequestChangesTaskInline}
                    onReopenTask={handleReopenTaskInline}
                    onApproveMeeting={handleApproveMeetingInline}
                    onRequestChangesMeeting={handleRequestChangesMeetingInline}
                    onReopenMeeting={handleReopenMeetingInline}
                    limit={50}
                  />
                )}
              </div>
            </div>
          )}

          {/* ── TASKS + MEETINGS ── */}
          {page === 'tasks' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ border: '1px solid var(--tf-border)', borderRadius: 18, overflow: 'hidden', background: 'var(--tf-panel)' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--tf-border)' }}>
                  <FilterBar
                    filters={filters}
                    onChange={setFilters}
                    onClear={() => setFilters(FILTERS_DEFAULT)}
                    includeType
                    includeAssignee
                    assignees={allProfiles}
                    searchPlaceholder="Search tasks and meetings"
                  />
                </div>
              </div>

              {showTaskLists && <div style={{ border: '1px solid var(--tf-border)', borderRadius: 18, overflow: 'hidden', background: 'var(--tf-panel)' }}>
                <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--tf-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--tf-muted)', letterSpacing: '0.3px', textTransform: 'uppercase' }}>
                    {filtered.length} Task{filtered.length !== 1 ? 's' : ''}
                  </span>
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={refetch}><RefreshCw size={12} /></button>
                </div>
                {loading
                  ? <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><span className="spinner" /></div>
                  : <TaskTable
                      tasks={filtered}
                      onDelete={deleteTask}
                      onUpdateStatus={updateStatus}
                      profileById={profileById}
                      onOpenTask={setDetailTask}
                      onApprove={handleApproveTaskInline}
                      onRequestChanges={handleRequestChangesTaskInline}
                      onReopen={handleReopenTaskInline}
                    />
                }
              </div>}

              {showMeetingLists && <div style={{ border: '1px solid var(--tf-border)', borderRadius: 18, overflow: 'hidden', background: 'var(--tf-panel)' }}>
                <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--tf-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--tf-muted)', letterSpacing: '0.3px', textTransform: 'uppercase' }}>
                    {filteredMeetings.length} Meeting{filteredMeetings.length !== 1 ? 's' : ''}
                  </span>
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={refetchMeetings}><RefreshCw size={12} /></button>
                </div>
                {meetingsLoading
                  ? <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><span className="spinner" /></div>
                  : <MeetingTable
                      meetings={filteredMeetings}
                      onDelete={deleteMeeting}
                      onUpdateStatus={updateMeetingStatus}
                      isAdmin
                      profileById={profileById}
                      onOpenMeeting={setDetailMeeting}
                      onApprove={handleApproveMeetingInline}
                      onRequestChanges={handleRequestChangesMeetingInline}
                      onReopen={handleReopenMeetingInline}
                    />
                }
              </div>}
            </div>
          )}

          {/* ── CALENDER ── */}
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

          {/* ── PROJECTS ── */}
          {page === 'projects' && (
            <ProjectsPanel
              projects={projects}
              loading={projectsLoading}
              createProject={createProject}
              getProgress={getProgress}
              onRefresh={refetchProjects}
              canCreate
              tasks={tasks}
              meetings={meetings}
              profileById={profileById}
              onAddTaskForProject={(projectId) => launchTaskForm({ projectId })}
              onAddMeetingForProject={(projectId) => launchMeetingForm({ projectId })}
              onOpenTask={(t) => setDetailTask(t)}
              onOpenMeeting={(m) => setDetailMeeting(m)}
              onUpdateTaskStatus={updateStatus}
              onUpdateMeetingStatus={updateMeetingStatus}
              onDeleteTask={deleteTask}
              onDeleteMeeting={deleteMeeting}
            />
          )}

          {/* ── USER MANAGEMENT ── */}
          {page === 'users' && (
            <div style={{ maxWidth: 900 }}>
              <UserManagement />
            </div>
          )}

          {page === 'notifications' && (
            <div
              style={{
                border: '1px solid var(--tf-border)',
                borderRadius: 18,
                background: 'var(--tf-panel)',
                padding: '24px 28px',
                maxWidth: 720,
              }}
            >
              <NotificationSettings />
            </div>
          )}

          {/* ── REMINDERS ── */}
          {page === 'email' && (
            <div style={{ maxWidth: 500 }}>
              <div style={{ border: '1px solid var(--tf-border)', borderRadius: 18, overflow: 'hidden', background: 'var(--tf-panel)' }}>
                <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--tf-border)' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--tf-muted)', letterSpacing: '0.3px', textTransform: 'uppercase' }}>Email Reminders</span>
                </div>
                <div style={{ padding: '20px 20px 24px' }}>
                  <p style={{ fontSize: 13, color: 'var(--tf-muted)', lineHeight: 1.8, marginBottom: 20 }}>
                    Sends an AI-written reminder email to every employee with a task due within the next 24 hours. Each email is generated by the AI using the task title, due date, and employee name.
                  </p>
                  <button className="btn btn-primary" onClick={handleSendReminders} disabled={sending}
                    style={{ width: '100%', justifyContent: 'center', padding: '10px' }}>
                    {sending ? <><span className="spinner" /> Sending…</> : <><Send size={13} /> Send Reminders Now</>}
                  </button>
                  {sendMsg && (
                    <div style={{ marginTop: 12, fontSize: 12, color: sendMsg.startsWith('Failed') ? 'var(--status-danger)' : 'var(--status-success)', textAlign: 'center' }}>
                      {sendMsg}
                    </div>
                  )}
                  <div style={{ marginTop: 20, borderTop: '1px solid var(--tf-border)', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                      'Scans all tasks due within 24 hours',
                      'Generates personalized email per employee via AI',
                      'Sends via Brevo SMTP API',
                      'Logs every sent email in email_logs table',
                    ].map((s, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 11, color: 'var(--tf-subhead)', fontWeight: 600, minWidth: 16, paddingTop: 1 }}>{i + 1}.</span>
                        <span style={{ fontSize: 12, color: 'var(--tf-subhead)', lineHeight: 1.6 }}>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Floating AI button */}
      {!showAI && (
        <button
          type="button"
          className="tf-fab"
          onClick={() => setShowAI(true)}
          title="AI Assistant"
        >
          <Sparkles size={20} color="#ffffff" strokeWidth={1.8} />
        </button>
      )}

      {showAI   && <AiChat  onClose={() => setShowAI(false)} />}

      <TaskDetailModal
        open={!!detailTask}
        task={detailTask}
        isAdmin
        profile={profile}
        projects={projects}
        profileById={profileById}
        updateTask={updateTask}
        submitTask={submitTask}
        approveTask={approveTask}
        requestTaskChanges={requestTaskChanges}
        getTaskHistory={getTaskHistory}
        onClose={() => setDetailTask(null)}
        onNavigateTask={(t) => setDetailTask(t)}
        onAddSubtask={(parentId, ctx = {}) =>
          launchTaskForm({ parentTaskId: parentId, projectId: ctx.projectId || '' })
        }
      />
      <MeetingDetailModal
        open={!!detailMeeting}
        meeting={detailMeeting}
        isAdmin
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

      {/* Create forms after detail modals so nested dialogs stay clickable (same z-index). */}
      {showForm && (
        <TaskForm
          key={taskFormKey}
          projects={projects}
          defaultProjectId={taskFormCtx.projectId}
          parentTaskId={taskFormCtx.parentTaskId}
          initialAssigneeIds={[]}
          onSubmit={createTask}
          onClose={() => {
            setShowForm(false);
            setTaskFormCtx({ projectId: '', parentTaskId: '' });
          }}
        />
      )}
      <CsvImportModal
        kind={importKind || 'task'}
        open={!!importKind}
        onClose={() => setImportKind(null)}
        onImported={() => { refetch(); refetchMeetings(); }}
      />

      {showMeetingForm && (
        <MeetingForm
          key={meetingFormKey}
          projects={projects}
          defaultProjectId={meetingFormCtx.projectId}
          parentMeetingId={meetingFormCtx.parentMeetingId}
          initialAssigneeIds={[]}
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

function hour() {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}
