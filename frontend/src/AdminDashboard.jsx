import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Sparkles, Send, RefreshCw } from 'lucide-react';
import { useAuth } from './AuthContext';
import { useTasks } from './useTasks';
import { useRealtime } from './useRealtime';
import Sidebar from './components/Sidebar';
import TaskTable from './components/TaskTable';
import TaskForm from './components/TaskForm';
import AiChat from './components/AiChat';
import FilterBar from './components/FilterBar';
import api from './api';

const FILTERS_DEFAULT = { search: '', status: '', priority: '' };

function Stat({ label, value, sub }) {
  return (
    <div style={{ padding: '20px 22px', borderRight: '1px solid #1a1a1a' }}>
      <div style={{ fontSize: 11, color: '#444', fontWeight: 500, letterSpacing: '0.4px', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 600, color: '#e4e4e4', letterSpacing: '-0.5px', lineHeight: 1 }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: 11, color: '#3a3a3a', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export default function AdminDashboard() {
  const { profile } = useAuth();
  const { tasks, loading, refetch, createTask, updateStatus, deleteTask } = useTasks();

  const [page,     setPage]     = useState('overview');
  const [showForm, setShowForm] = useState(false);
  const [showAI,   setShowAI]   = useState(false);
  const [filters,  setFilters]  = useState(FILTERS_DEFAULT);
  const [stats,    setStats]    = useState(null);
  const [sending,  setSending]  = useState(false);
  const [sendMsg,  setSendMsg]  = useState('');

  useRealtime('tasks', useCallback(() => refetch(), [refetch]));

  useEffect(() => {
    api.get('/admin/dashboard')
      .then(({ data }) => setStats(data))
      .catch(() => {});
  }, [tasks]);

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
    return true;
  });

  const today = new Date().toISOString().split('T')[0];
  const overdue = tasks.filter((t) => t.due_date && t.due_date < today && t.status !== 'completed');

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#080808' }}>
      <Sidebar active={page} onNav={setPage} />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header */}
        <div style={{
          height: 52, background: '#0a0a0a', borderBottom: '1px solid #1a1a1a',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 24px', flexShrink: 0,
        }}>
          <div>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#ddd' }}>
              {page === 'overview' ? `Good ${hour()}, ${profile?.full_name?.split(' ')[0] || 'Admin'}` :
               page === 'tasks'   ? 'All Tasks' : 'Reminders'}
            </span>
            {page === 'overview' && (
              <span style={{ fontSize: 12, color: '#3a3a3a', marginLeft: 10 }}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {sendMsg && (
              <span style={{ fontSize: 12, color: sendMsg.startsWith('Failed') ? '#f87171' : '#4ade80' }}>{sendMsg}</span>
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
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

          {/* ── OVERVIEW ── */}
          {page === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Stats row */}
              <div style={{ border: '1px solid #1a1a1a', borderRadius: 6, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', background: '#0e0e0e', overflow: 'hidden' }}>
                <Stat label="Total Tasks"  value={stats?.total}     />
                <Stat label="Completed"    value={stats?.completed} />
                <Stat label="Overdue"      value={stats?.overdue}   sub={stats?.overdue > 0 ? 'Needs attention' : undefined} />
                <Stat label="Pending"      value={stats?.pending}   />
              </div>

              {/* Overdue alert */}
              {overdue.length > 0 && (
                <div style={{
                  background: 'rgba(248,113,113,0.04)',
                  border: '1px solid rgba(248,113,113,0.15)',
                  borderRadius: 6, padding: '11px 16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span style={{ fontSize: 13, color: '#f87171' }}>
                    {overdue.length} task{overdue.length !== 1 ? 's' : ''} past due date
                  </span>
                  <button className="btn btn-ghost btn-sm" onClick={() => setPage('tasks')}>View tasks</button>
                </div>
              )}

              {/* Recent tasks */}
              <div style={{ border: '1px solid #1a1a1a', borderRadius: 6, overflow: 'hidden', background: '#0c0c0c' }}>
                <div style={{ padding: '13px 16px', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#666', letterSpacing: '0.3px', textTransform: 'uppercase' }}>Recent Tasks</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-ghost btn-sm btn-icon" onClick={refetch}><RefreshCw size={12} /></button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setPage('tasks')}>View all</button>
                  </div>
                </div>
                {loading
                  ? <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><span className="spinner" /></div>
                  : <TaskTable tasks={tasks.slice(0, 10)} onDelete={deleteTask} onUpdateStatus={updateStatus} />
                }
              </div>
            </div>
          )}

          {/* ── TASKS ── */}
          {page === 'tasks' && (
            <div style={{ border: '1px solid #1a1a1a', borderRadius: 6, overflow: 'hidden', background: '#0c0c0c' }}>
              <div style={{ padding: '13px 16px', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#666', letterSpacing: '0.3px', textTransform: 'uppercase' }}>
                  {filtered.length} Task{filtered.length !== 1 ? 's' : ''}
                </span>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={refetch}><RefreshCw size={12} /></button>
              </div>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #1a1a1a' }}>
                <FilterBar filters={filters} onChange={setFilters} onClear={() => setFilters(FILTERS_DEFAULT)} />
              </div>
              {loading
                ? <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><span className="spinner" /></div>
                : <TaskTable tasks={filtered} onDelete={deleteTask} onUpdateStatus={updateStatus} />
              }
            </div>
          )}

          {/* ── REMINDERS ── */}
          {page === 'email' && (
            <div style={{ maxWidth: 500 }}>
              <div style={{ border: '1px solid #1a1a1a', borderRadius: 6, overflow: 'hidden', background: '#0c0c0c' }}>
                <div style={{ padding: '13px 16px', borderBottom: '1px solid #1a1a1a' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#666', letterSpacing: '0.3px', textTransform: 'uppercase' }}>Email Reminders</span>
                </div>
                <div style={{ padding: '20px 20px 24px' }}>
                  <p style={{ fontSize: 13, color: '#555', lineHeight: 1.8, marginBottom: 20 }}>
                    Sends an AI-written reminder email to every employee with a task due within the next 24 hours. Each email is generated by the AI using the task title, due date, and employee name.
                  </p>
                  <button className="btn btn-primary" onClick={handleSendReminders} disabled={sending}
                    style={{ width: '100%', justifyContent: 'center', padding: '10px' }}>
                    {sending ? <><span className="spinner" /> Sending…</> : <><Send size={13} /> Send Reminders Now</>}
                  </button>
                  {sendMsg && (
                    <div style={{ marginTop: 12, fontSize: 12, color: sendMsg.startsWith('Failed') ? '#f87171' : '#4ade80', textAlign: 'center' }}>
                      {sendMsg}
                    </div>
                  )}
                  <div style={{ marginTop: 20, borderTop: '1px solid #1a1a1a', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                      'Scans all tasks due within 24 hours',
                      'Generates personalized email per employee via AI',
                      'Sends via Brevo SMTP API',
                      'Logs every sent email in email_logs table',
                    ].map((s, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 11, color: '#333', fontWeight: 600, minWidth: 16, paddingTop: 1 }}>{i + 1}.</span>
                        <span style={{ fontSize: 12, color: '#444', lineHeight: 1.6 }}>{s}</span>
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
          onClick={() => setShowAI(true)}
          title="AI Assistant"
          style={{
            position: 'fixed', bottom: 28, right: 28, zIndex: 40,
            width: 48, height: 48, borderRadius: '50%',
            background: '#3b82f6', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(59,130,246,0.45)',
            transition: 'transform 150ms ease, box-shadow 150ms ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(59,130,246,0.6)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(59,130,246,0.45)'; }}
        >
          <Sparkles size={20} color="#fff" strokeWidth={1.8} />
        </button>
      )}

      {showForm && <TaskForm onSubmit={createTask} onClose={() => setShowForm(false)} />}
      {showAI   && <AiChat  onClose={() => setShowAI(false)} />}
    </div>
  );
}

function hour() {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}
