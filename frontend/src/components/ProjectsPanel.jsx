import React, { useEffect, useState } from 'react';
import { Plus, FolderKanban } from 'lucide-react';

function ProgressBar({ pct }) {
  return (
    <div style={{ height: 6, background: '#1a1a1a', borderRadius: 3, overflow: 'hidden', marginTop: 8 }}>
      <div
        style={{
          height: '100%',
          width: `${pct}%`,
          background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
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
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [progressById, setProgressById] = useState({});

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

  if (loading) {
    return (
      <div style={{ padding: 48, display: 'flex', justifyContent: 'center' }}>
        <span className="spinner" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
            Projects
          </div>
          <div style={{ fontSize: 11, color: '#444', marginTop: 4 }}>
            Group tasks and meetings; track completion progress per project.
          </div>
        </div>
        {canCreate && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
            <Plus size={13} /> New project
          </button>
        )}
      </div>

      {showCreate && (
        <div
          className="overlay"
          onClick={(e) => e.target === e.currentTarget && !saving && setShowCreate(false)}
        >
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
          <FolderKanban size={28} color="#333" style={{ marginBottom: 8 }} />
          <div style={{ fontSize: 13, color: '#555' }}>No projects yet. Create one to organize tasks and meetings.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {projects.map((p) => {
            const pr = progressById[p.id];
            const pct = pr?.percent_complete ?? 0;
            return (
              <div
                key={p.id}
                style={{
                  border: '1px solid #1a1a1a',
                  borderRadius: 6,
                  padding: '14px 16px',
                  background: '#0c0c0c',
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 600, color: '#ddd' }}>{p.name}</div>
                {p.description && (
                  <div style={{ fontSize: 12, color: '#555', marginTop: 4, lineHeight: 1.5 }}>{p.description}</div>
                )}
                <div style={{ marginTop: 10, fontSize: 11, color: '#555' }}>
                  {pr ? (
                    <>
                      <span style={{ color: '#888' }}>
                        {pr.completed}/{pr.total} tasks completed
                      </span>
                      <span style={{ marginLeft: 12, color: '#666' }}>{pct}%</span>
                    </>
                  ) : (
                    <span>Loading progress…</span>
                  )}
                </div>
                {pr && <ProgressBar pct={pct} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
