import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Plus, Sparkles, Send, RefreshCw } from 'lucide-react';
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
  const { tasks, loading, refetch, createTask, updateStatus, deleteTask, updateTask } = useTasks();
  const {
    meetings,
    loading: meetingsLoading,
    refetch: refetchMeetings,
    createMeeting,
    updateStatus: updateMeetingStatus,
    deleteMeeting,
    updateMeeting,
  } = useMeetings();

  const { projects, refetch: refetchProjects, createProject, getProgress, loading: projectsLoading } = useProjects();

  const [page,     setPage]     = useState(() => sessionStorage.getItem('taskflow_admin_page') || 'overview');
  const [showForm, setShowForm] = useState(false);
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [showAI,   setShowAI]   = useState(false);
  const [filters,  setFilters]  = useState(FILTERS_DEFAULT);
  const [employees, setEmployees] = useState([]);
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

  useRealtime('tasks', useCallback(() => refetch(), [refetch]));
  useRealtime('meetings', useCallback(() => refetchMeetings(), [refetchMeetings]));

  useEffect(() => {
    if (!profile?.id) return;
    api
      .get('/auth/profiles')
      .then(({ data }) => {
        const list = data || [];
        setAllProfiles(list);
        setEmployees(list.filter((p) => p.role === 'employee'));
      })
      .catch(() => {
        setAllProfiles([]);
        setEmployees([]);
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

  const filtered = tasks.filter((t) => {
    const q = filters.search.toLowerCase();
    if (q && !t.title.toLowerCase().includes(q) && !(t.description || '').toLowerCase().includes(q)) return false;
    if (filters.status   && t.status   !== filters.status)   return false;
    if (filters.priority && t.priority !== filters.priority) return false;
    if (filters.assignee_id && !matchesAssigneeFilter(t, filters.assignee_id)) return false;
    return true;
  });
  const filteredMeetings = meetings.filter((m) => {
    const q = filters.search.toLowerCase();
    if (q && !m.title.toLowerCase().includes(q) && !(m.description || '').toLowerCase().includes(q)) return false;
    if (filters.status && m.status !== filters.status) return false;
    if (filters.priority && m.priority !== filters.priority) return false;
    if (filters.assignee_id && !matchesAssigneeFilter(m, filters.assignee_id)) return false;
    return true;
  });

  const showTaskLists = filters.type !== 'meeting';
  const showMeetingLists = filters.type !== 'task';

  const today = new Date().toISOString().split('T')[0];
  const overdue = tasks.filter((t) => t.due_date && t.due_date < today && t.status !== 'completed');

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
                        : 'Reminders'}
            </span>
            {page === 'overview' && (
              <span style={{ fontSize: 15, color: 'var(--tf-muted)', marginLeft: 12, fontWeight: 400 }}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {sendMsg && (
              <span style={{ fontSize: 14, color: sendMsg.startsWith('Failed') ? 'var(--status-danger)' : 'var(--status-success)' }}>{sendMsg}</span>
            )}
            <button className="btn btn-ghost btn-sm" onClick={handleSendReminders} disabled={sending}>
              {sending ? <span className="spinner" /> : <Send size={12} />}
              Send Reminders
            </button>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setShowAI(true)} title="AI Assistant">
              <Sparkles size={13} />
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
              <Plus size={13} /> New Task
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowMeetingForm(true)}>
              <Plus size={13} /> New Meeting
            </button>
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
                <MiniStat label="Pending tasks" value={overviewStats?.pending_tasks} />
                <MiniStat label="Pending meetings" value={overviewStats?.pending_meetings} />
                <MiniStat label="Completed tasks" value={overviewStats?.completed_tasks} />
                <MiniStat label="Completed meetings" value={overviewStats?.completed_meetings} />
                <MiniStat label="Overdue tasks" value={overviewStats?.overdue_tasks} />
                <MiniStat label="Overdue meetings" value={overviewStats?.overdue_meetings} />
                <MiniStat label="Team members" value={overviewStats?.total_users} />
              </div>

              <div style={{ border: '1px solid var(--tf-border)', borderRadius: 18, overflow: 'hidden', background: 'var(--tf-panel)' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--tf-border)' }}>
                  <FilterBar
                    filters={filters}
                    onChange={setFilters}
                    onClear={() => setFilters(FILTERS_DEFAULT)}
                    includeType
                    includeAssignee
                    assignees={employees}
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
                    tasks={showTaskLists ? filtered : []}
                    meetings={showMeetingLists ? filteredMeetings : []}
                    loading={(showTaskLists && loading) || (showMeetingLists && meetingsLoading)}
                    meetingsLoading={false}
                    profileById={profileById}
                    onDeleteTask={deleteTask}
                    onUpdateTaskStatus={updateStatus}
                    onDeleteMeeting={deleteMeeting}
                    onUpdateMeetingStatus={updateMeetingStatus}
                    onOpenTaskDetail={setDetailTask}
                    onOpenMeetingDetail={setDetailMeeting}
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
                    assignees={employees}
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
                  : <TaskTable tasks={filtered} onDelete={deleteTask} onUpdateStatus={updateStatus} profileById={profileById} onOpenTask={setDetailTask} />
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
                  : <MeetingTable meetings={filteredMeetings} onDelete={deleteMeeting} onUpdateStatus={updateMeetingStatus} isAdmin profileById={profileById} onOpenMeeting={setDetailMeeting} />
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
              assignees={employees}
              includeEmployeeFilter
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
            />
          )}

          {/* ── USER MANAGEMENT ── */}
          {page === 'users' && (
            <div style={{ maxWidth: 900 }}>
              <UserManagement />
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

      {showForm && (
        <TaskForm projects={projects} onSubmit={createTask} onClose={() => setShowForm(false)} />
      )}
      {showMeetingForm && (
        <MeetingForm projects={projects} onSubmit={createMeeting} onClose={() => setShowMeetingForm(false)} />
      )}
      {showAI   && <AiChat  onClose={() => setShowAI(false)} />}

      <TaskDetailModal
        open={!!detailTask}
        task={detailTask}
        isAdmin
        projects={projects}
        profileById={profileById}
        updateTask={updateTask}
        onClose={() => setDetailTask(null)}
      />
      <MeetingDetailModal
        open={!!detailMeeting}
        meeting={detailMeeting}
        isAdmin
        projects={projects}
        profileById={profileById}
        updateMeeting={updateMeeting}
        onClose={() => setDetailMeeting(null)}
      />
    </div>
  );
}

function hour() {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}
