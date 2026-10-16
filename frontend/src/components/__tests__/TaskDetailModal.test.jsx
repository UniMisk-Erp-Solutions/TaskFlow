import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const state = { subtasks: [] };

vi.mock('../../api', () => {
  const get = vi.fn(async (url) => {
    if (url === '/tasks/t1') {
      return { data: { id: 't1', title: 'Parent task', description: '', status: 'in_progress', priority: 'medium', assignee_ids: ['u1', 'u2'], project_id: null, subtasks: state.subtasks } };
    }
    return { data: [] };
  });
  const post = vi.fn(async (url, body) => {
    if (url === '/tasks') {
      state.subtasks = [...state.subtasks, { id: `s${state.subtasks.length + 1}`, title: body.title, status: 'pending', parent_task_id: body.parent_task_id }];
      return { data: { id: 's1' } };
    }
    return { data: {} };
  });
  return { default: { get, post, patch: vi.fn(), defaults: { baseURL: '' } } };
});

vi.mock('../../supabaseClient', () => ({
  default: { channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel: () => {} },
}));
vi.mock('../MultiEmployeeSelect', () => ({ default: () => <div data-testid="assignees" /> }));
vi.mock('../ProjectSelect', () => ({ default: () => <div data-testid="project" /> }));
vi.mock('../AttachmentsSection', () => ({ default: () => <div data-testid="attachments" /> }));

import api from '../../api';
import TaskDetailModal from '../TaskDetailModal';

function Harness({ historyFn, isAdmin = true, profile = { id: 'u1', role: 'admin' } }) {
  return (
    <TaskDetailModal
      open
      task={{ id: 't1' }}
      isAdmin={isAdmin}
      profile={profile}
      projects={[]}
      profileById={{ u1: 'Una', u2: 'Bo' }}
      updateTask={vi.fn(async (_id, payload) => ({ id: 't1', ...payload }))}
      getTaskHistory={historyFn}
      onClose={() => {}}
      onNavigateTask={() => {}}
      onAddSubtask={() => {}}
      onTasksChanged={() => {}}
    />
  );
}

describe('TaskDetailModal', () => {
  beforeEach(() => {
    state.subtasks = [];
    vi.clearAllMocks();
  });

  it('stays in edit mode and keeps typed text when the parent re-renders with new callbacks', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Harness historyFn={async () => []} />);
    await screen.findByText('Parent task');

    await user.click(screen.getByLabelText('Edit task'));
    const title = await screen.findByDisplayValue('Parent task');
    await user.clear(title);
    await user.type(title, 'Renamed task');

    // The dashboard re-renders every few seconds and hands down a brand-new function each time.
    for (let i = 0; i < 5; i += 1) {
      await act(async () => { rerender(<Harness historyFn={async () => []} />); });
    }

    expect(screen.getByDisplayValue('Renamed task')).toBeInTheDocument();
    expect(screen.getByText('Edit task')).toBeInTheDocument();
    // The task record was fetched once on open, not once per re-render.
    expect(api.get.mock.calls.filter(([url]) => url === '/tasks/t1')).toHaveLength(1);
  });

  it('saves an edit and returns to the read-only view', async () => {
    const user = userEvent.setup();
    render(<Harness historyFn={async () => []} />);
    await screen.findByText('Parent task');
    await user.click(screen.getByLabelText('Edit task'));
    const title = await screen.findByDisplayValue('Parent task');
    await user.clear(title);
    await user.type(title, 'Saved title');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByDisplayValue('Saved title')).not.toBeInTheDocument());
    expect(screen.getByText('Task')).toBeInTheDocument();
  });

  it('adds a subtask from the read-only view and lists it', async () => {
    const user = userEvent.setup();
    render(<Harness historyFn={async () => []} />);
    await screen.findByText('Parent task');
    const input = await screen.findByLabelText('New subtask title');
    await user.type(input, 'Write the tests');
    await user.click(screen.getByRole('button', { name: /Add$/ }));

    await screen.findByText('Write the tests');
    const call = api.post.mock.calls.find(([url]) => url === '/tasks');
    expect(call[1]).toMatchObject({ title: 'Write the tests', parent_task_id: 't1', assignee_ids: ['u1', 'u2'] });
    expect(screen.getByLabelText('New subtask title')).toHaveValue('');
  });

  it('lets an assigned employee add a subtask for themselves but hides it from non-assignees', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Harness historyFn={async () => []} isAdmin={false} profile={{ id: 'u2', role: 'employee' }} />);
    const input = await screen.findByLabelText('New subtask title');
    await user.type(input, 'My part');
    await user.click(screen.getByRole('button', { name: /Add$/ }));
    await screen.findByText('My part');
    expect(api.post.mock.calls.find(([url]) => url === '/tasks')[1].assignee_ids).toEqual(['u2']);
    unmount();

    render(<Harness historyFn={async () => []} isAdmin={false} profile={{ id: 'u9', role: 'employee' }} />);
    await screen.findByText('Parent task');
    expect(screen.queryByLabelText('New subtask title')).not.toBeInTheDocument();
  });
});
