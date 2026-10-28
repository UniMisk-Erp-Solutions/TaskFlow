import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, Github, Loader2 } from 'lucide-react';
import api from '../api';

/**
 * Settings → Integrations card for GitHub.
 *
 *  - Every user connects / disconnects their own GitHub account (GitHub App user authorization;
 *    TaskFlow stores only the GitHub id + login, never a token).
 *  - Admins also link the GitHub App installation to the organization, which authorizes its
 *    repositories without any per-repository setup in TaskFlow.
 */

const REASONS = {
  not_configured: 'GitHub is not configured on this server yet.',
  token_exchange_failed: 'GitHub did not accept the sign-in. Please try again.',
  github_profile_unavailable: 'Could not read your GitHub profile. Please try again.',
  user_not_found: 'Your TaskFlow profile could not be found.',
  no_organization: 'Join or create an organization before connecting GitHub.',
  already_linked: 'That GitHub account is already connected to another TaskFlow user.',
  save_failed: 'Could not save the connection. Please try again.',
  bad_installation: 'GitHub returned an invalid installation.',
  app_not_configured: 'The GitHub App credentials are not configured on the server.',
  not_member: 'Your TaskFlow account no longer belongs to the organization that started this install.',
  connect_first: 'Connect your GitHub account first, then install the app.',
  installation_not_yours: 'That personal GitHub account belongs to someone else. Install the app on your own account or an organization you belong to.',
  bad_private_key: 'The GitHub App private key on the server is invalid.',
  installation_not_verified: 'GitHub could not confirm that installation for this app.',
  installation_claimed: 'That installation is already linked to another organization.',
};

function flashFromUrl() {
  try {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('github');
    if (!code) return null;
    const reason = url.searchParams.get('reason');
    url.searchParams.delete('github');
    url.searchParams.delete('reason');
    window.history.replaceState({}, '', url.pathname + (url.search || '') + url.hash);
    switch (code) {
      case 'connected': return { ok: true, text: 'GitHub account connected.' };
      case 'installed': return { ok: true, text: 'GitHub App installation linked to your organization.' };
      case 'install_requested': return { ok: true, text: 'Installation requested. An owner of the GitHub organization must approve it.' };
      case 'denied': return { ok: false, text: 'GitHub authorization was cancelled.' };
      default: return { ok: false, text: REASONS[reason] || 'GitHub connection failed. Please try again.' };
    }
  } catch {
    return null;
  }
}

const panel = {
  border: '1px solid var(--tf-border)', borderRadius: 14, background: 'var(--tf-panel)',
  padding: 20, display: 'flex', flexDirection: 'column', gap: 16,
};
const pill = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 999,
  fontSize: 12, fontWeight: 600, background: 'rgba(34,197,94,0.12)', color: 'var(--status-success, #16a34a)',
};
const infoBox = {
  border: '1px solid var(--tf-border)', borderRadius: 10, padding: '10px 12px', background: 'var(--tf-pearl)',
  fontSize: 12, color: 'var(--tf-muted)', lineHeight: 1.6,
};
const code = { fontFamily: 'ui-monospace, monospace', fontSize: 11, background: 'var(--tf-bg, rgba(127,127,127,.12))', padding: '1px 5px', borderRadius: 4, wordBreak: 'break-all' };

export default function GithubConnectCard() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [flash, setFlash] = useState(() => flashFromUrl());
  const [loadError, setLoadError] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [tokenMsg, setTokenMsg] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/github/status');
      setStatus(data);
      setLoadError('');
    } catch (e) {
      setLoadError(e.response?.data?.error || 'Could not load GitHub settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const returnTo = () => `${window.location.origin}${window.location.pathname}`;

  async function go(kind, endpoint) {
    setBusy(kind);
    setFlash(null);
    try {
      const { data } = await api.post(endpoint, { return_to: returnTo() });
      window.location.assign(data.url);
    } catch (e) {
      setFlash({ ok: false, text: e.response?.data?.error || 'Could not start the GitHub flow.' });
      setBusy('');
    }
  }

  async function disconnect() {
    if (!window.confirm('Disconnect your GitHub account? Your pushes and pull requests will no longer update TaskFlow tasks.')) return;
    setBusy('disconnect');
    try {
      await api.delete('/github/connection');
      setFlash({ ok: true, text: 'GitHub account disconnected.' });
      await load();
    } catch (e) {
      setFlash({ ok: false, text: e.response?.data?.error || 'Could not disconnect.' });
    } finally {
      setBusy('');
    }
  }

  async function removeInstallation(id) {
    if (!window.confirm('Unlink this GitHub installation from TaskFlow? Activity from its repositories will be ignored. (The app stays installed on GitHub until you uninstall it there.)')) return;
    setBusy(`inst-${id}`);
    try {
      await api.delete(`/github/installations/${id}`);
      await load();
    } catch (e) {
      setFlash({ ok: false, text: e.response?.data?.error || 'Could not unlink the installation.' });
    } finally {
      setBusy('');
    }
  }

  async function saveToken(e) {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    setBusy('token');
    setTokenMsg(null);
    try {
      await api.put('/github/token', { token: tokenInput.trim() });
      setTokenInput('');
      setTokenMsg({ ok: true, text: 'Token saved. TaskFlow will now watch the repositories named on your In Progress tasks.' });
      await load();
    } catch (err) {
      setTokenMsg({ ok: false, text: err.response?.data?.error || 'Could not save the token.' });
    } finally {
      setBusy('');
    }
  }

  async function removeToken() {
    if (!window.confirm('Remove your saved GitHub token? TaskFlow will stop checking repositories for you (the GitHub App, if installed, keeps working).')) return;
    setBusy('token');
    try {
      await api.delete('/github/token');
      setTokenMsg({ ok: true, text: 'Token removed.' });
      await load();
    } catch (err) {
      setTokenMsg({ ok: false, text: err.response?.data?.error || 'Could not remove the token.' });
    } finally {
      setBusy('');
    }
  }

  async function checkNow() {
    setBusy('check');
    setTokenMsg(null);
    try {
      const { data } = await api.post('/github/poll/me');
      const moved = data?.submitted || 0;
      setTokenMsg({
        ok: true,
        text: moved
          ? `Checked: ${moved} task${moved === 1 ? '' : 's'} submitted for review.`
          : `Checked ${data?.tasks ?? 0} task${data?.tasks === 1 ? '' : 's'} with a repository. No new commits to submit.`,
      });
      await load();
    } catch (err) {
      setTokenMsg({ ok: false, text: err.response?.data?.error || 'Could not run the check.' });
    } finally {
      setBusy('');
    }
  }

  const conn = status?.connection;
  const tokenInfo = status?.token;
  const pollingReady = !!status?.configured?.polling;
  const installs = status?.installations || [];
  const isAdmin = !!status?.is_admin;
  const oauthReady = !!status?.configured?.oauth;
  const appReady = !!status?.configured?.app;
  const webhookReady = !!status?.configured?.webhook;

  return (
    <div style={panel} data-testid="github-card">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: '#24292f', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Github size={22} />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--tf-text)' }}>GitHub</h3>
            {conn && <span style={pill}><CheckCircle2 size={13} /> Connected</span>}
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--tf-muted)', lineHeight: 1.55 }}>
            {conn
              ? <>Connected as <strong style={{ color: 'var(--tf-text)' }}>@{conn.github_login}</strong>. When you push code or open a pull request that references a task, TaskFlow links it and submits the task for admin approval — even when TaskFlow is closed.</>
              : 'Connect your GitHub account so your pushes and pull requests can update your TaskFlow tasks automatically.'}
          </p>
        </div>
      </div>

      {flash && (
        <div role="status" style={{ ...infoBox, color: flash.ok ? 'var(--status-success, #16a34a)' : 'var(--status-danger)' }}>
          {flash.text}
        </div>
      )}
      {loadError && <div role="alert" style={{ ...infoBox, color: 'var(--status-danger)' }}>{loadError}</div>}

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--tf-muted)', fontSize: 13 }}>
          <Loader2 className="spinner" size={16} /> Loading…
        </div>
      ) : status && (
        <>
          {!oauthReady && (
            <div style={infoBox}>
              <strong style={{ color: 'var(--tf-text)' }}>GitHub isn't set up on this server yet.</strong>{' '}
              {isAdmin
                ? <>Create the GitHub App and set its credentials as described in <code style={code}>docs/github-integration.md</code>.</>
                : 'Ask an administrator to finish the GitHub App setup.'}
            </div>
          )}

          {oauthReady && !conn && (
            <div>
              <button type="button" className="btn btn-primary" onClick={() => go('connect', '/github/connect')} disabled={!!busy}>
                {busy === 'connect' ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <Github size={14} />} Connect GitHub
              </button>
            </div>
          )}

          {conn && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => go('connect', '/github/connect')} disabled={!!busy}>
                Switch account
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={disconnect} disabled={!!busy} style={{ color: 'var(--status-danger)' }}>
                {busy === 'disconnect' ? <span className="spinner" style={{ width: 14, height: 14 }} /> : null} Disconnect
              </button>
              <span style={{ fontSize: 11, color: 'var(--tf-muted)' }}>
                To fully revoke access, also remove TaskFlow under GitHub → Settings → Applications.
              </span>
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--tf-border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tf-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Authorized repositories
            </div>
            {installs.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--tf-muted)' }}>
                No repositories are authorized yet. Install the TaskFlow GitHub App on the GitHub account or organization that owns the repository and select the repositories it may watch. If you do not own the repository, the GitHub owner or an organization administrator has to approve the installation. Connecting your GitHub account alone does not give the app access to a repository.
              </div>
            )}
            {installs.map((i) => (
              <div key={i.installation_id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13 }}>
                <strong style={{ color: 'var(--tf-text)' }}>{i.account_login}</strong>
                <span style={{ color: 'var(--tf-muted)' }}>
                  {i.repository_selection === 'all' ? 'all repositories' : i.repository_selection === 'selected' ? 'selected repositories' : ''}
                </span>
                {i.suspended_at && <span style={{ ...pill, background: 'rgba(248,113,113,0.12)', color: 'var(--status-danger)' }}>Suspended</span>}
                {i.can_manage && (
                  <>
                    <a href={i.manage_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      Choose repositories <ExternalLink size={11} />
                    </a>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeInstallation(i.installation_id)} disabled={!!busy}>
                      Unlink
                    </button>
                  </>
                )}
              </div>
            ))}
            {appReady && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => go('install', '/github/install-url')} disabled={!!busy || !conn}>
                  {busy === 'install' ? <span className="spinner" style={{ width: 14, height: 14 }} /> : null}
                  {installs.length ? 'Add another account / organization' : 'Install GitHub App'}
                </button>
                {!conn && <span style={{ fontSize: 11, color: 'var(--tf-muted)' }}>Connect your GitHub account first.</span>}
              </div>
            )}
            {isAdmin && !appReady && oauthReady && (
              <div style={infoBox}>Set <code style={code}>GITHUB_APP_ID</code>, <code style={code}>GITHUB_APP_SLUG</code> and <code style={code}>GITHUB_APP_PRIVATE_KEY</code> to enable installation.</div>
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--tf-border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tf-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              No app on the repository? Use your own token
            </div>
            {!pollingReady ? (
              <div style={infoBox}>Saving a token is not enabled on this server yet (it needs <code style={code}>GITHUB_TOKEN_ENC_KEY</code>).</div>
            ) : tokenInfo ? (
              <>
                <div style={{ fontSize: 13, color: 'var(--tf-muted)', lineHeight: 1.55 }}>
                  Token saved for <strong style={{ color: 'var(--tf-text)' }}>@{tokenInfo.github_login}</strong> (ends in {tokenInfo.token_hint}).
                  TaskFlow checks the repository named on each of your In Progress tasks every minute or so and submits the task when you commit to it.
                  {tokenInfo.last_checked_at ? ` Last checked ${new Date(tokenInfo.last_checked_at).toLocaleString()}.` : ' Not checked yet.'}
                </div>
                {tokenInfo.last_error && <div role="alert" style={{ ...infoBox, color: 'var(--status-danger)' }}>{tokenInfo.last_error}</div>}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={checkNow} disabled={!!busy}>
                    {busy === 'check' ? <span className="spinner" style={{ width: 14, height: 14 }} /> : null} Check now
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={removeToken} disabled={!!busy} style={{ color: 'var(--status-danger)' }}>
                    Remove token
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={saveToken} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--tf-muted)', lineHeight: 1.6 }}>
                  On GitHub: Settings → Developer settings → Personal access tokens → <strong>Fine-grained tokens</strong> → Generate. Choose the account or organization that owns the repository as
                  <em> Resource owner</em>, select that repository, and give <strong>Contents: Read-only</strong>. (A classic token with the <code style={code}>repo</code> scope also works.)
                  If the organization requires approval for tokens, an owner must approve it. The token is stored encrypted and only used to read commits.
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    className="input"
                    type="password"
                    style={{ flex: 1, minWidth: 220 }}
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="Paste your GitHub token"
                    aria-label="GitHub token"
                    autoComplete="off"
                  />
                  <button type="submit" className="btn btn-ghost btn-sm" disabled={!!busy || !tokenInput.trim()}>
                    {busy === 'token' ? <span className="spinner" style={{ width: 14, height: 14 }} /> : null} Save token
                  </button>
                </div>
              </form>
            )}
            {tokenMsg && <div role="status" style={{ ...infoBox, color: tokenMsg.ok ? 'var(--status-success, #16a34a)' : 'var(--status-danger)' }}>{tokenMsg.text}</div>}
          </div>

          {isAdmin && (!webhookReady || !oauthReady || !appReady) && status.setup && (
            <div style={infoBox}>
              <div style={{ color: 'var(--tf-text)', fontWeight: 600, marginBottom: 4 }}>Values for the GitHub App settings page</div>
              <div>Webhook URL: <code style={code}>{status.setup.webhook_url}</code></div>
              <div>Callback URL: <code style={code}>{status.setup.callback_url}</code></div>
              <div>Setup URL: <code style={code}>{status.setup.setup_url}</code></div>
              {!webhookReady && <div style={{ marginTop: 4, color: 'var(--status-danger)' }}>GITHUB_WEBHOOK_SECRET is not set — webhooks are rejected until it is.</div>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
