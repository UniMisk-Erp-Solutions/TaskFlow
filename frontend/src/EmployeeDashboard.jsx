import React, { useCallback, useMemo, useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { useAuth } from './AuthContext';
import { useTasks } from './useTasks';
import { useRealtime } from './useRealtime';
import TaskCard from './components/TaskCard';
import Navbar from './components/Navbar';
import AiChat from './components/AiChat';

function Stat({ label, value, color }) {
  return (
    <div style={{ flex: 1, padding: '16px 18px', borderRight: '1px solid #1a1a1a', minWidth: 100 }}>
      <div style={{ fontSize: 10, fontWeight: 500, color: '#3a3a3a', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 600, color: color || '#ddd', letterSpacing: '-0.3px' }}>{value}</div>
    </div>
  );
}

function Group({ label, tasks, onUpdateStatus, accent }) {
  const [open, setOpen] = useState(true);
  if (!tasks.length) return null;
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
        background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 12px',
      }}>
        <span style={{ display: 'block', width: 2, height: 13, background: accent, borderRadius: 1, flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: '#888' }}>{label}</span>
        <span style={{ fontSize: 11, color: '#333', background: '#111', border: '1px solid #1e1e1e', padding: '1px 7px', borderRadius: 20 }}>{tasks.length}</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#333' }}>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10, marginBottom: 24 }}>
          {tasks.map((t) => <TaskCard key={t.id} task={t} onUpdateStatus={onUpdateStatus} />)}
        </div>
      )}
    </div>
  );
}

export default function EmployeeDashboard() {
  const { profile } = useAuth();
  const { tasks, loading, refetch, updateStatus } = useTasks();
  const [showAI, setShowAI] = useState(false);

  useRealtime('tasks', useCallback(() => refetch(), [refetch]));

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
    <div style={{ minHeight: '100vh', background: '#080808', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <div style={{ flex: 1, maxWidth: 920, width: '100%', margin: '0 auto', padding: '28px 24px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 600, color: '#ddd', letterSpacing: '-0.3px' }}>
              {greeting()}, {profile?.full_name?.split(' ')[0] || 'there'}
            </h1>
            <div style={{ fontSize: 12, color: '#3a3a3a', marginTop: 3 }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              {stats.overdue > 0 && <span style={{ color: '#f87171', marginLeft: 10 }}>{stats.overdue} overdue</span>}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={refetch}><RefreshCw size={13} /></button>
        </div>

        {/* Stats */}
        <div style={{ border: '1px solid #1a1a1a', borderRadius: 6, display: 'flex', background: '#0c0c0c', marginBottom: 24, overflow: 'hidden' }}>
          <Stat label="Total"     value={stats.total}     />
          <Stat label="Pending"   value={stats.pending}   color="#fbbf24" />
          <Stat label="Completed" value={stats.completed} color="#4ade80" />
          <Stat label="Overdue"   value={stats.overdue}   color={stats.overdue > 0 ? '#f87171' : '#ddd'} />
        </div>

        {/* Overdue alert */}
        {stats.overdue > 0 && (
          <div style={{ background: 'rgba(248,113,113,0.04)', border: '1px solid rgba(248,113,113,0.15)', borderRadius: 5, padding: '10px 14px', marginBottom: 22 }}>
            <span style={{ fontSize: 12, color: '#f87171' }}>
              {stats.overdue} task{stats.overdue !== 1 ? 's are' : ' is'} overdue. Update the status or contact your admin.
            </span>
          </div>
        )}

        {/* Tasks */}
        {loading
          ? <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><span className="spinner" style={{ width: 20, height: 20 }} /></div>
          : tasks.length === 0
            ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#333' }}>
                <div style={{ fontSize: 13 }}>No tasks assigned to you yet.</div>
              </div>
            ) : (
              <div>
                <Group label="Overdue"     tasks={groups.overdue}    onUpdateStatus={updateStatus} accent="#f87171" />
                <Group label="Blocked"     tasks={groups.blocked}    onUpdateStatus={updateStatus} accent="#f87171" />
                <Group label="In Progress" tasks={groups.inProgress} onUpdateStatus={updateStatus} accent="#818cf8" />
                <Group label="Pending"     tasks={groups.pending}    onUpdateStatus={updateStatus} accent="#fbbf24" />
                <Group label="Completed"   tasks={groups.completed}  onUpdateStatus={updateStatus} accent="#4ade80" />
              </div>
            )
        }
      </div>

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

      {showAI && <AiChat onClose={() => setShowAI(false)} />}
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
