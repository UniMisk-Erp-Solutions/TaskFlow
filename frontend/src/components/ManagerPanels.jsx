import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2, UserPlus, CheckCircle2 } from 'lucide-react';
import api from '../api';
import SelectMenu from './SelectMenu';

const card = { background: 'var(--tf-panel)', border: '1px solid var(--tf-border)', borderRadius: 16, padding: 16 };
const muted = { color: 'var(--tf-muted)', fontSize: 13 };

function errText(err, fallback) {
  return err?.response?.data?.error || err?.message || fallback;
}

/** Teams this manager runs, plus the employees they can pick from. */
export function useManagerTeams(enabled = true) {
  const [teams, setTeams] = useState([]);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');

  const refetch = useCallback(async () => {
    if (!enabled) return;
    try {
      const [t, p] = await Promise.all([api.get('/manager/teams'), api.get('/manager/people')]);
      setTeams(Array.isArray(t.data) ? t.data : []);
      setPeople(Array.isArray(p.data) ? p.data : []);
      setError('');
    } catch (err) {
      setError(errText(err, 'Could not load your teams.'));
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => { refetch(); }, [refetch]);

  const memberIds = useMemo(() => [...new Set(teams.flatMap((t) => t.members.map((m) => m.id)))], [teams]);
  return { teams, people, memberIds, loading, error, refetch };
}

function MemberPicker({ people, value, onChange }) {
  if (!people.length) return <div style={muted}>There are no employees in this workspace yet. Add one from “Add User”.</div>;
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--tf-border)', borderRadius: 11, padding: '6px 10px', background: 'var(--tf-pearl)' }}>
      {people.map((p) => (
        <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 2px', cursor: 'pointer', fontSize: 14, color: 'var(--tf-text)' }}>
          <input type="checkbox" checked={value.includes(p.id)} onChange={() => toggle(p.id)} style={{ accentColor: 'var(--color-primary)' }} />
          <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{p.full_name || p.email}<span style={{ ...muted, marginLeft: 8, fontSize: 12 }}>{p.email}</span></span>
        </label>
      ))}
    </div>
  );
}

function TeamEditor({ team, people, onCancel, onSaved }) {
  const [name, setName] = useState(team?.name || '');
  const [members, setMembers] = useState(team ? team.members.map((m) => m.id) : []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save(e) {
    e.preventDefault();
    if (!name.trim()) { setError('Enter a team name.'); return; }
    setBusy(true);
    setError('');
    try {
      if (team) await api.patch(`/manager/teams/${team.id}`, { name: name.trim(), member_ids: members });
      else await api.post('/manager/teams', { name: name.trim(), member_ids: members });
      await onSaved();
    } catch (err) {
      setError(errText(err, 'Could not save the team.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} style={{ ...card, display: 'grid', gap: 12 }}>
      <strong style={{ fontSize: 15, color: 'var(--tf-text)' }}>{team ? 'Edit team' : 'New team'}</strong>
      <div className="form-group">
        <label className="form-label" htmlFor="team-name">Team name</label>
        <input id="team-name" className="input" value={name} maxLength={80} placeholder="e.g. Design, Sales" onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">Members <span style={{ ...muted, fontWeight: 400 }}>({members.length} selected)</span></label>
        <MemberPicker people={people} value={members} onChange={setMembers} />
      </div>
      {error && <div className="form-error">{error}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>{busy ? <span className="spinner" /> : team ? 'Save team' : 'Create team'}</button>
      </div>
    </form>
  );
}

export function TeamsPage({ data }) {
  const { teams, people, loading, error, refetch } = data;
  const [editing, setEditing] = useState(null); // null | 'new' | team
  const [notice, setNotice] = useState('');

  async function remove(team) {
    if (!window.confirm(`Delete the team “${team.name}”? Its members stay in the workspace.`)) return;
    try {
      await api.delete(`/manager/teams/${team.id}`);
      setNotice('Team deleted.');
      await refetch();
    } catch (err) {
      setNotice(errText(err, 'Could not delete the team.'));
    }
  }

  if (loading) return <div className="spinner" style={{ width: 22, height: 22 }} />;
  return (
    <div style={{ display: 'grid', gap: 14, maxWidth: 980 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <p style={{ margin: 0, ...muted, fontSize: 14 }}>Make teams of employees. Work they submit comes to you for approval before it reaches an admin.</p>
        {!editing && <button type="button" className="btn btn-primary btn-sm" onClick={() => { setNotice(''); setEditing('new'); }}><Plus size={14} /> New team</button>}
      </div>
      {error && <div role="alert" className="form-error">{error}</div>}
      {notice && <div role="status" style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--tf-pearl)', color: 'var(--tf-text)', fontSize: 13 }}>{notice}</div>}
      {editing && (
        <TeamEditor
          key={editing === 'new' ? 'new' : editing.id}
          team={editing === 'new' ? null : editing}
          people={people}
          onCancel={() => setEditing(null)}
          onSaved={async () => { setEditing(null); setNotice('Team saved.'); await refetch(); }}
        />
      )}
      {!teams.length && !editing && !error && (
        <div style={{ ...card, textAlign: 'center', color: 'var(--tf-muted)', borderStyle: 'dashed' }}>You haven’t made a team yet. Create one to start assigning work.</div>
      )}
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {teams.map((t) => (
          <div key={t.id} style={{ ...card, display: 'grid', gap: 10, alignContent: 'start' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: 'var(--tf-text)', overflowWrap: 'anywhere' }}>{t.name}</div>
                <div style={muted}>{t.members.length} member{t.members.length === 1 ? '' : 's'}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={`Edit ${t.name}`} title="Edit" onClick={() => { setNotice(''); setEditing(t); }}><Pencil size={15} /></button>
                <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={`Delete ${t.name}`} title="Delete" onClick={() => remove(t)} style={{ color: 'var(--status-danger)' }}><Trash2 size={15} /></button>
              </div>
            </div>
            {t.members.length ? (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 4 }}>
                {t.members.map((m) => <li key={m.id} style={{ fontSize: 14, color: 'var(--tf-text)', overflowWrap: 'anywhere' }}>{m.full_name || m.email}</li>)}
              </ul>
            ) : <div style={muted}>No members yet.</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AddUserPage({ data }) {
  const { teams, refetch } = data;
  const [form, setForm] = useState({ fullName: '', email: '', password: '', phone: '', team_id: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    setNotice('');
    if (!form.fullName.trim() || !form.email.trim() || form.password.length < 6) {
      setError('Enter a name, an email and a password of at least 6 characters.');
      return;
    }
    setBusy(true);
    try {
      const { data: res } = await api.post('/manager/users', { ...form, fullName: form.fullName.trim(), team_id: form.team_id || undefined });
      setNotice(`${res.full_name} was added${form.team_id ? ' to the team' : ''}. They can sign in with the email and password you set.`);
      setForm({ fullName: '', email: '', password: '', phone: '', team_id: form.team_id });
      await refetch();
    } catch (err) {
      setError(errText(err, 'Could not add the user.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ ...card, display: 'grid', gap: 12, maxWidth: 520 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--tf-text)' }}><UserPlus size={18} /><strong style={{ fontSize: 15 }}>Add an employee</strong></div>
      <div className="form-group">
        <label className="form-label" htmlFor="mu-name">Full name</label>
        <input id="mu-name" className="input" value={form.fullName} onChange={(e) => set('fullName', e.target.value)} placeholder="Jane Doe" autoComplete="off" />
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="mu-email">Email</label>
        <input id="mu-email" className="input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="jane@company.com" autoComplete="off" />
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="mu-pass">Password</label>
        <input id="mu-pass" className="input" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" />
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="mu-phone">Mobile number <span style={{ ...muted, fontWeight: 400 }}>(optional)</span></label>
        <input id="mu-phone" className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91 98765 43210" inputMode="tel" />
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="mu-team">Add to team <span style={{ ...muted, fontWeight: 400 }}>(optional)</span></label>
        <select id="mu-team" className="input" value={form.team_id} onChange={(e) => set('team_id', e.target.value)}>
          <option value="">No team yet</option>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      {error && <div role="alert" className="form-error">{error}</div>}
      {notice && <div role="status" style={{ fontSize: 13, color: 'var(--status-success)' }}>{notice}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>{busy ? <span className="spinner" /> : 'Add user'}</button>
      </div>
    </form>
  );
}

function TaskRow({ task, profileById, onOpen, badge }) {
  const who = (task.assignee_ids?.length ? task.assignee_ids : [task.assignee_id]).filter(Boolean).map((id) => profileById[id] || 'Unknown').join(', ');
  return (
    <button type="button" onClick={() => onOpen(task)} style={{ ...card, textAlign: 'left', cursor: 'pointer', display: 'grid', gap: 6, font: 'inherit', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, color: 'var(--tf-text)', overflowWrap: 'anywhere' }}>{task.title}</span>
        {badge}
      </div>
      <div style={muted}>{who || 'Unassigned'}{task.due_date ? ` · due ${task.due_date}` : ''}</div>
      {task.submission_notes && <div style={{ fontSize: 13, color: 'var(--tf-subhead)', overflowWrap: 'anywhere' }}>“{task.submission_notes}”</div>}
    </button>
  );
}

const pill = (text, color) => (
  <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, color, background: 'var(--tf-pearl)', whiteSpace: 'nowrap' }}>{text}</span>
);

/** Submitted work waiting on this manager, then what they've already passed to the admin. */
export function ApprovalsPage({ tasks, profileById, onOpen, currentUserId }) {
  const waiting = tasks.filter((t) => t.status === 'submitted' && t.review_stage === 'manager');
  const passed = tasks.filter((t) => t.status === 'submitted' && t.review_stage === 'admin' && t.manager_approved_by === currentUserId);
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 980 }}>
      <p style={{ margin: 0, ...muted, fontSize: 14 }}>Your team submits work to you first. When you approve it, it goes to an admin for the final approval.</p>
      <section style={{ display: 'grid', gap: 10 }}>
        <h2 style={{ fontSize: 14, margin: 0, color: 'var(--tf-muted)' }}>Waiting for your approval ({waiting.length})</h2>
        {waiting.length ? waiting.map((t) => <TaskRow key={t.id} task={t} profileById={profileById} onOpen={onOpen} badge={pill('Needs your review', 'var(--status-warning)')} />)
          : <div style={{ ...card, borderStyle: 'dashed', textAlign: 'center', color: 'var(--tf-muted)' }}><CheckCircle2 size={22} /><div style={{ marginTop: 6 }}>Nothing is waiting for you.</div></div>}
      </section>
      {passed.length > 0 && (
        <section style={{ display: 'grid', gap: 10 }}>
          <h2 style={{ fontSize: 14, margin: 0, color: 'var(--tf-muted)' }}>Approved by you, waiting for an admin ({passed.length})</h2>
          {passed.map((t) => <TaskRow key={t.id} task={t} profileById={profileById} onOpen={onOpen} badge={pill('Awaiting admin', 'var(--color-primary)')} />)}
        </section>
      )}
    </div>
  );
}

const STATUS_FILTERS = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'submitted', label: 'Waiting for review' },
  { value: 'completed', label: 'Completed' },
  { value: 'blocked', label: 'Blocked' },
];

const assigneeIdsOf = (t) => (t.assignee_ids?.length ? t.assignee_ids : [t.assignee_id]).filter(Boolean);

/** Everything assigned to your teammates, filtered by person and status so a big team isn't one long list. */
export function AssignTaskPage({ tasks, memberIds, profileById, onNewTask, onOpen, currentUserId }) {
  const [member, setMember] = useState('all');
  const [status, setStatus] = useState('all');
  const teamTasks = useMemo(
    () => tasks.filter((t) => assigneeIdsOf(t).some((id) => memberIds.includes(id) && id !== currentUserId)),
    [tasks, memberIds, currentUserId],
  );
  const memberOptions = useMemo(() => [
    { value: 'all', label: `All teammates (${teamTasks.length})` },
    ...memberIds
      .filter((id) => id !== currentUserId)
      .map((id) => ({ value: id, label: `${profileById[id] || 'Unknown'} (${teamTasks.filter((t) => assigneeIdsOf(t).includes(id)).length})` }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  ], [memberIds, teamTasks, profileById, currentUserId]);
  const shown = teamTasks.filter((t) => (member === 'all' || assigneeIdsOf(t).includes(member)) && (status === 'all' || t.status === status));

  return (
    <div style={{ display: 'grid', gap: 14, maxWidth: 980 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <p style={{ margin: 0, ...muted, fontSize: 14 }}>
          {memberIds.length ? 'See what your teammates are working on, and give a task to anyone in your teams.' : 'Make a team first, then you can assign tasks to its members.'}
        </p>
        <button type="button" className="btn btn-primary btn-sm" onClick={onNewTask} disabled={!memberIds.length}><Plus size={14} /> Assign task</button>
      </div>
      {teamTasks.length > 0 && (
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Teammate</label>
            <SelectMenu value={member} onChange={setMember} options={memberOptions} ariaLabel="Filter by teammate" />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Status</label>
            <SelectMenu value={status} onChange={setStatus} options={STATUS_FILTERS} ariaLabel="Filter by status" />
          </div>
        </div>
      )}
      {teamTasks.length > 0 && <div style={muted}>Showing {shown.length} of {teamTasks.length} task{teamTasks.length === 1 ? '' : 's'}</div>}
      {shown.length ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {shown.map((t) => <TaskRow key={t.id} task={t} profileById={profileById} onOpen={onOpen} badge={pill(String(t.status || '').replaceAll('_', ' '), 'var(--tf-muted)')} />)}
        </div>
      ) : memberIds.length > 0 && <div style={{ ...card, borderStyle: 'dashed', textAlign: 'center', color: 'var(--tf-muted)' }}>{teamTasks.length ? 'No tasks match these filters.' : 'No tasks have been assigned to your teams yet.'}</div>}
    </div>
  );
}
