import React, { useCallback, useEffect, useState } from 'react';
import { Copy, ExternalLink, GitBranch, GitCommit, GitPullRequest, Trash2 } from 'lucide-react';
import api from '../api';
import { formatDateTime } from '../lib/dateFormat';

/** Same format the API uses: `TF-` + the first 8 hex characters of the task id. */
export function taskRef(taskId) {
  return `TF-${String(taskId || '').replace(/-/g, '').slice(0, 8).toLowerCase()}`;
}

const STATE_COLORS = {
  open: 'var(--status-success, #16a34a)',
  merged: '#8250df',
  closed: 'var(--status-danger)',
  draft: 'var(--tf-muted)',
};

function safeHref(url) {
  return typeof url === 'string' && /^https:\/\/github\.com\//i.test(url) ? url : null;
}

function LinkRow({ link, canRemove, onRemove, busy }) {
  const href = safeHref(link.url);
  const Icon = link.kind === 'pull_request' ? GitPullRequest : link.kind === 'branch' ? GitBranch : GitCommit;
  const label = link.kind === 'commit'
    ? `${String(link.ref).slice(0, 7)} ${link.title || ''}`.trim()
    : link.kind === 'pull_request'
      ? `#${link.ref} ${link.title || ''}`.trim()
      : link.ref;
  return (
    <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '5px 0', minWidth: 0 }}>
      <Icon size={14} style={{ flexShrink: 0, color: 'var(--tf-muted)' }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--tf-text)', wordBreak: 'break-word' }}>
            {label} <ExternalLink size={10} style={{ verticalAlign: 'baseline' }} />
          </a>
        ) : <span>{label}</span>}
        <div style={{ fontSize: 11, color: 'var(--tf-muted)' }}>
          {link.repo_full_name}
          {link.author_login ? ` · @${link.author_login}` : ''}
          {link.source === 'manual' ? ' · linked manually' : ''}
          {link.created_at ? ` · ${formatDateTime(link.created_at)}` : ''}
        </div>
      </div>
      {link.kind === 'pull_request' && link.state && (
        <span style={{ fontSize: 11, fontWeight: 600, color: STATE_COLORS[link.state] || 'var(--tf-muted)', textTransform: 'capitalize' }}>{link.state}</span>
      )}
      {canRemove && (
        <button type="button" className="btn btn-ghost btn-sm" title="Remove link" aria-label="Remove link" onClick={() => onRemove(link)} disabled={busy}>
          <Trash2 size={13} />
        </button>
      )}
    </li>
  );
}

/**
 * GitHub activity linked to a task: the task's reference, linked pull requests / branches /
 * commits, and a form to link one explicitly. Linking happens automatically from webhooks.
 */
export default function TaskGithubSection({ taskId, canEdit = false, isAdmin = false, refreshKey = '' }) {
  const [data, setData] = useState(null);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showAllCommits, setShowAllCommits] = useState(false);
  const [copied, setCopied] = useState(false);
  const [repoInput, setRepoInput] = useState('');
  const [branchInput, setBranchInput] = useState('');
  const [repoBusy, setRepoBusy] = useState(false);
  const [repoMsg, setRepoMsg] = useState('');

  const load = useCallback(async () => {
    if (!taskId) return;
    try {
      const res = await api.get(`/tasks/${taskId}/github`);
      const d = res?.data;
      setData({
        task_ref: d?.task_ref || taskRef(taskId),
        links: Array.isArray(d?.links) ? d.links : [],
        connected: !!d?.connected,
        github_repo: d?.github_repo || null,
        github_branch: d?.github_branch || null,
      });
      setRepoInput(d?.github_repo || '');
      setBranchInput(d?.github_branch || '');
    } catch {
      setData({ task_ref: taskRef(taskId), links: [], connected: false });
    }
  }, [taskId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  if (!taskId) return null;
  const ref = data?.task_ref || taskRef(taskId);
  const links = data?.links || [];
  const prs = links.filter((l) => l.kind === 'pull_request');
  const branches = links.filter((l) => l.kind === 'branch');
  const commits = links.filter((l) => l.kind === 'commit');
  const shownCommits = showAllCommits ? commits : commits.slice(0, 5);

  async function copy() {
    try {
      await navigator.clipboard.writeText(ref);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  }

  async function addLink(e) {
    e.preventDefault();
    if (!input.trim()) return;
    setBusy(true);
    setError('');
    try {
      await api.post(`/tasks/${taskId}/github/links`, { input: input.trim() });
      setInput('');
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not link that item.');
    } finally {
      setBusy(false);
    }
  }

  async function saveRepo(e) {
    e.preventDefault();
    setRepoBusy(true);
    setError('');
    setRepoMsg('');
    try {
      const { data: saved } = await api.put(`/tasks/${taskId}/github/repo`, { repo: repoInput, branch: branchInput });
      setData((d) => ({ ...d, github_repo: saved?.github_repo || null, github_branch: saved?.github_branch || null }));
      setRepoInput(saved?.github_repo || '');
      setBranchInput(saved?.github_branch || '');
      setRepoMsg(saved?.github_repo ? 'Repository saved.' : 'Repository cleared.');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save the repository.');
    } finally {
      setRepoBusy(false);
    }
  }

  async function removeLink(link) {
    setBusy(true);
    setError('');
    try {
      await api.delete(`/tasks/${taskId}/github/links/${link.id}`);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not remove that link.');
    } finally {
      setBusy(false);
    }
  }

  const canRemove = (l) => canEdit && (l.source === 'manual' || isAdmin);
  const group = (title, rows) => rows.length > 0 && (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--tf-muted)', textTransform: 'uppercase', marginTop: 6 }}>{title}</div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {rows.map((l) => <LinkRow key={l.id} link={l} canRemove={canRemove(l)} onRemove={removeLink} busy={busy} />)}
      </ul>
    </div>
  );

  return (
    <div style={{ borderTop: '1px solid var(--tf-border)', paddingTop: 12 }} data-testid="task-github">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tf-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>GitHub</div>
        <code style={{ fontSize: 12, padding: '1px 6px', borderRadius: 4, background: 'var(--tf-pearl)', border: '1px solid var(--tf-border)' }}>{ref}</code>
        <button type="button" className="btn btn-ghost btn-sm" onClick={copy} title="Copy task reference">
          <Copy size={12} /> {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--tf-muted)', lineHeight: 1.5 }}>
        Put <strong>{ref}</strong> in a branch name (e.g. <code>feature/{ref}-short-name</code>), commit message or pull request title and TaskFlow links it automatically.
        {canEdit && data && !data.connected && ' Connect your GitHub account in Settings → Integrations so your activity counts.'}
      </div>

      {(canEdit || data?.github_repo) && (
        <form onSubmit={saveRepo} style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--tf-muted)', textTransform: 'uppercase' }}>Repository</span>
          {canEdit ? (
            <>
              <input className="input" style={{ flex: 1, minWidth: 180 }} value={repoInput} onChange={(e) => setRepoInput(e.target.value)}
                placeholder="owner/repo" aria-label="GitHub repository" maxLength={300} autoComplete="off" />
              <input className="input" style={{ width: 170 }} value={branchInput} onChange={(e) => setBranchInput(e.target.value)}
                placeholder="branch (optional)" aria-label="GitHub branch" maxLength={250} autoComplete="off" />
              <button type="submit" className="btn btn-ghost btn-sm" disabled={repoBusy}>Save</button>
            </>
          ) : (
            <code style={{ fontSize: 12 }}>{data.github_repo}{data.github_branch ? ` @ ${data.github_branch}` : ''}</code>
          )}
          {repoMsg && <span style={{ fontSize: 11, color: 'var(--status-success, #16a34a)' }}>{repoMsg}</span>}
        </form>
      )}
      {data?.github_repo && (
        <div style={{ fontSize: 11, color: 'var(--tf-muted)', marginTop: 4 }}>
          A push or pull request by the assignee in <strong>{data.github_repo}</strong>{data.github_branch ? ` on ${data.github_branch}` : ''} moves this task to Done for approval, even without the task reference. This works through the GitHub App, or through your saved token (Settings → Notifications → GitHub), which is checked every minute or so.
        </div>
      )}

      {links.length === 0 && <div style={{ fontSize: 12, color: 'var(--tf-muted)', marginTop: 8 }}>No GitHub activity linked yet.</div>}
      {group('Pull requests', prs)}
      {group('Branches', branches)}
      {group('Commits', shownCommits)}
      {commits.length > 5 && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAllCommits((v) => !v)}>
          {showAllCommits ? 'Show fewer commits' : `Show all ${commits.length} commits`}
        </button>
      )}

      {canEdit && (
        <form onSubmit={addLink} style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <input
            className="input"
            style={{ flex: 1, minWidth: 220 }}
            placeholder="Link a PR or branch: URL, owner/repo#12 or owner/repo:branch"
            aria-label="GitHub pull request or branch to link"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={500}
          />
          <button type="submit" className="btn btn-ghost btn-sm" disabled={busy || !input.trim()}>Link</button>
        </form>
      )}
      {error && <div className="form-error" style={{ marginTop: 6 }}>{error}</div>}
    </div>
  );
}
