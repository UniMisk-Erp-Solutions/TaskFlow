import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, FolderKanban, Plus } from 'lucide-react';
import OverviewUnified from './OverviewUnified';

function ProgressBar({ pct }) {
  return (
    <div style={{ height: 6, background: 'var(--color-divider-soft)', borderRadius: 3, overflow: 'hidden', marginTop: 8 }}>
      <div
        style={{
          height: '100%',
          width: `${pct}%`,
          background: 'var(--color-primary)',
          borderRadius: 3,
          transition: 'width 0.3s ease',
        }}
      />
    </div>
  );
}

export default function ProjectsPanel({
  projects,
  loading,
  createProject,
  getProgress,
  onRefresh,
  canCreate = true,
  tasks = [],
  meetings = [],
  profileById = {},
  onAddTaskForProject,
  onAddMeetingForProject,
  onOpenTask,
  onOpenMeeting,
  onUpdateTaskStatus,
  onUpdateMeetingStatus,
  onDeleteTask,
  onDeleteMeeting,
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [progressById, setProgressById] = useState({});
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = {};
      for (const p of projects) {
        try {
          const pr = await getProgress(p.id);
          if (!cancelled) next[p.id] = pr;
        } catch {
          if (!cancelled) next[p.id] = null;
        }
      }
      if (!cancelled) setProgressById(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [projects, getProgress]);

  async function handleCreate(e) {
    e.preventDefault();
    setErr('');
    if (!name.trim()) {
      setErr('Name is required');
      return;
    }
    setSaving(true);
    try {
      await createProject({ name: name.trim(), description: description.trim() || null });
      setName('');
      setDescription('');
      setShowCreate(false);
      onRefresh?.();
    } catch (er) {
      setErr(er.response?.data?.error || er.message);
    } finally {
      setSaving(false);
    }
  }

  function toggleExpanded(id) {
    setExpandedId((cur) => (cur === id ? null : id));
  }

  const hideDelete = !(onDeleteTask || onDeleteMeeting);

  if (loading) {
    return (
      <div style={{ padding: 48, display: 'flex', justifyContent: 'center' }}>
        <span className="spinner" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 980 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tf-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Projects
          </div>
          <div style={{ fontSize: 13, color: 'var(--tf-muted)', marginTop: 6, lineHeight: 1.47 }}>
            Open a project — task and meeting lists match the Overview table layout (sort columns, inline status).
          </div>
        </div>
        {canCreate && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
            <Plus size={13} /> New project
          </button>
        )}
      </div>

      {showCreate && (
        <div className="overlay" role="presentation">
          <div className="modal" style={{ maxWidth: 400 }}>
            <h2 style={{ fontSize: 16, marginBottom: 14 }}>Create project</h2>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Name</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Q2 rollout" />
              </div>
              <div className="form-group">
                <label className="form-label">Description (optional)</label>
                <textarea
                  className="input"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short summary…"
                />
              </div>
              {err && <div className="form-error">{err}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                  {saving ? <span className="spinner" /> : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {!projects.length ? (
        <div className="empty" style={{ padding: 32 }}>
          <FolderKanban size={28} color="var(--tf-muted)" style={{ marginBottom: 8 }} />
          <div style={{ fontSize: 15, color: 'var(--tf-muted)' }}>No projects yet. Create one to organize tasks and meetings.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {projects.map((p) => {
            const pr = progressById[p.id];
            const pct = pr?.percent_complete ?? 0;
            const expanded = expandedId === p.id;
            const projTasks = (tasks || [])
              .filter((t) => t.project_id === p.id)
              .map((t) => ({ ...t, project_name: t.project_name || p.name }));
            const projMeetings = (meetings || [])
              .filter((m) => m.project_id === p.id)
              .map((m) => ({ ...m, project_name: m.project_name || p.name }));

            const hasUnifiedRows = projTasks.length + projMeetings.length > 0;

            return (
              <div
                key={p.id}
                style={{
                  border: '1px solid var(--tf-border)',
                  borderRadius: 18,
                  background: 'var(--tf-panel)',
                  overflow: 'hidden',
                }}
              >
                <button
                  type="button"
                  onClick={() => toggleExpanded(p.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    padding: '17px 20px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                  }}
                >
                  {expanded ? <ChevronDown size={20} color="var(--tf-muted)" style={{ marginTop: 2 }} /> : <ChevronRight size={20} color="var(--tf-muted)" style={{ marginTop: 2 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--tf-text)', letterSpacing: '-0.015em' }}>{p.name}</div>
                    {p.description && (
                      <div style={{ fontSize: 14, color: 'var(--tf-muted)', marginTop: 6, lineHeight: 1.47 }}>{p.description}</div>
                    )}
                    <div style={{ marginTop: 12, fontSize: 13, color: 'var(--tf-muted)' }}>
                      {pr ? (
                        <>
                          <span>
                            {pr.completed}/{pr.total} tasks completed
                          </span>
                          <span style={{ marginLeft: 12 }}>{pct}%</span>
                        </>
                      ) : (
                        <span>Loading progress…</span>
                      )}
                    </div>
                    {pr && <ProgressBar pct={pct} />}
                  </div>
                </button>

                {expanded && (
                  <div style={{ padding: '0 14px 16px', borderTop: '1px solid var(--tf-border)', background: 'var(--tf-pearl)' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '14px 6px 10px' }}>
                      {onAddTaskForProject && (
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => onAddTaskForProject(p.id)}>
                          <Plus size={13} /> Task for project
                        </button>
                      )}
                      {onAddMeetingForProject && (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onAddMeetingForProject(p.id)}>
                          <Plus size={13} /> Meeting for project
                        </button>
                      )}
                    </div>

                    <div
                      style={{
                        borderRadius: 18,
                        overflow: 'hidden',
                        border: '1px solid var(--tf-border)',
                        background: 'var(--tf-panel)',
                      }}
                    >
                      {hasUnifiedRows ? (
                        <OverviewUnified
                          tasks={projTasks}
                          meetings={projMeetings}
                          loading={false}
                          meetingsLoading={false}
                          profileById={profileById}
                          onDeleteTask={hideDelete ? undefined : onDeleteTask}
                          onDeleteMeeting={hideDelete ? undefined : onDeleteMeeting}
                          onUpdateTaskStatus={onUpdateTaskStatus}
                          onUpdateMeetingStatus={onUpdateMeetingStatus}
                          onOpenTaskDetail={onOpenTask}
                          onOpenMeetingDetail={onOpenMeeting}
                          hideDeleteColumn={hideDelete}
                          limit={500}
                        />
                      ) : (
                        <div className="empty" style={{ padding: 28 }}>
                          <div style={{ fontSize: 14, color: 'var(--tf-muted)', lineHeight: 1.5 }}>
                            No tasks or meetings for this project yet. Use the buttons above or assign an existing item to “{p.name}” from details.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
