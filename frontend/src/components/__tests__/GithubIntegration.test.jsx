import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const state = { links: [], status: {}, repo: null };

vi.mock('../../api', () => {
  const get = vi.fn(async (url) => {
    if (url === '/github/status') return { data: state.status };
    if (url === '/tasks/1a2b3c4d-0000-4000-8000-000000000001/github') {
      return { data: { task_ref: 'TF-1a2b3c4d', links: state.links, connected: true, github_repo: state.repo || null, github_branch: null } };
    }
    return { data: [] };
  });
  const post = vi.fn(async (url, body) => {
    if (url.endsWith('/github/links')) {
      state.links = [...state.links, { id: 'm1', kind: 'pull_request', repo_full_name: 'acme/web', ref: '9', title: 'acme/web#9', url: 'https://github.com/acme/web/pull/9', source: 'manual', created_at: '2026-10-22T10:00:00Z' }];
      return { data: state.links[state.links.length - 1] };
    }
    if (url === '/github/connect') return { data: { url: 'https://github.com/login/oauth/authorize?x=1' } };
    return { data: {} };
  });
  const put = vi.fn(async (url, body) => {
    if (url.endsWith('/github/repo')) { state.repo = String(body.repo || '').toLowerCase() || null; return { data: { github_repo: state.repo, github_branch: body.branch || null } }; }
    return { data: {} };
  });
  return { default: { get, post, put, delete: vi.fn(async () => ({ data: { ok: true } })), defaults: { baseURL: '' } } };
});

import api from '../../api';
import TaskGithubSection, { taskRef } from '../TaskGithubSection';
import GithubConnectCard from '../GithubConnectCard';

const TASK = '1a2b3c4d-0000-4000-8000-000000000001';

describe('TaskGithubSection', () => {
  beforeEach(() => { state.links = []; state.repo = null; vi.clearAllMocks(); });

  it('derives the same task reference the API uses', () => {
    expect(taskRef(TASK)).toBe('TF-1a2b3c4d');
  });

  it('shows the reference and linked pull requests, branches and commits', async () => {
    state.links = [
      { id: 'a', kind: 'pull_request', repo_full_name: 'acme/web', ref: '7', title: 'Login', state: 'merged', url: 'https://github.com/acme/web/pull/7', source: 'auto', author_login: 'alice' },
      { id: 'b', kind: 'branch', repo_full_name: 'acme/web', ref: 'feature/TF-1a2b3c4d-login', url: 'https://github.com/acme/web/tree/feature/TF-1a2b3c4d-login', source: 'auto' },
      { id: 'c', kind: 'commit', repo_full_name: 'acme/web', ref: 'abc1234def', title: 'add form', url: 'https://github.com/acme/web/commit/abc1234def', source: 'auto' },
    ];
    render(<TaskGithubSection taskId={TASK} canEdit={false} />);
    expect(await screen.findByText(/#7 Login/)).toBeInTheDocument();
    expect(screen.getByText('merged')).toBeInTheDocument();
    expect(screen.getByText('feature/TF-1a2b3c4d-login')).toBeInTheDocument();
    expect(screen.getByText(/abc1234 add form/)).toBeInTheDocument();
    expect(screen.getAllByText('TF-1a2b3c4d').length).toBeGreaterThan(0);
    expect(screen.queryByLabelText(/pull request or branch to link/i)).toBeNull();
  });

  it('never renders a non-GitHub URL as a link', async () => {
    state.links = [{ id: 'x', kind: 'pull_request', repo_full_name: 'a/b', ref: '1', title: 'evil', url: 'javascript:alert(1)', source: 'auto' }];
    render(<TaskGithubSection taskId={TASK} canEdit={false} />);
    const label = await screen.findByText(/#1 evil/);
    expect(label.closest('a')).toBeNull();
  });

  it('lets an assignee set the task repository', async () => {
    const user = userEvent.setup();
    render(<TaskGithubSection taskId={TASK} canEdit />);
    const input = await screen.findByLabelText('GitHub repository');
    await user.type(input, 'UniMisk-Erp-Solutions/TaskFlow');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith(`/tasks/${TASK}/github/repo`, { repo: 'UniMisk-Erp-Solutions/TaskFlow', branch: '' }));
    expect(await screen.findByText('Repository saved.')).toBeInTheDocument();
    expect(screen.getByText(/moves this task to Done for approval/i)).toBeInTheDocument();
  });

  it('shows the repository read-only to people who cannot edit', async () => {
    state.repo = 'acme/web';
    render(<TaskGithubSection taskId={TASK} canEdit={false} />);
    expect(await screen.findByText('acme/web', { selector: 'code' })).toBeInTheDocument();
    expect(screen.queryByLabelText('GitHub repository')).toBeNull();
    state.repo = null;
  });

  it('lets an assignee link a PR explicitly', async () => {
    const user = userEvent.setup();
    render(<TaskGithubSection taskId={TASK} canEdit />);
    await user.type(await screen.findByLabelText(/pull request or branch to link/i), 'https://github.com/acme/web/pull/9');
    await user.click(screen.getByRole('button', { name: 'Link' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`/tasks/${TASK}/github/links`, { input: 'https://github.com/acme/web/pull/9' }));
    expect(await screen.findByText(/acme\/web#9/)).toBeInTheDocument();
  });
});

describe('GithubConnectCard', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('offers Connect when configured and not yet connected, and explains the missing admin step otherwise', async () => {
    state.status = { configured: { oauth: true, app: true, webhook: true }, is_admin: false, connection: null, installations: [], setup: null };
    const { unmount } = render(<GithubConnectCard />);
    expect(await screen.findByRole('button', { name: /connect github/i })).toBeInTheDocument();
    expect(screen.getByText(/no repositories are authorized yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /install github app/i })).toBeDisabled();
    unmount();

    state.status = { configured: { oauth: false, app: false, webhook: false }, is_admin: false, connection: null, installations: [], setup: null };
    render(<GithubConnectCard />);
    expect(await screen.findByText(/isn't set up on this server yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /connect github/i })).toBeNull();
  });

  it('shows the connected account with disconnect, and admin installation controls', async () => {
    state.status = {
      configured: { oauth: true, app: true, webhook: true }, is_admin: true,
      connection: { github_login: 'alice-gh' },
      installations: [{ installation_id: 5, can_manage: true, account_login: 'acme', repository_selection: 'selected', manage_url: 'https://github.com/organizations/acme/settings/installations/5' }],
      setup: { webhook_url: 'x', callback_url: 'y', setup_url: 'z' },
    };
    render(<GithubConnectCard />);
    expect(await screen.findByText('@alice-gh')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument();
    expect(screen.getByText('acme')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add another account/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /choose repositories/i })).toHaveAttribute('href', expect.stringContaining('/installations/5'));
  });
});
