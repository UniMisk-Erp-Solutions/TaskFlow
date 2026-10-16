import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../MultiEmployeeSelect', () => ({ default: () => <div data-testid="assignees" /> }));
vi.mock('../ProjectSelect', () => ({ default: () => <div data-testid="project" /> }));
vi.mock('../AttachmentPicker', () => ({ default: () => <div />, uploadStagedAttachments: vi.fn() }));
vi.mock('../ClockTimePicker', () => ({ default: () => <div /> }));

import TaskForm from '../TaskForm';

const tasks = [
  { id: 'p1', title: 'Parent one', status: 'in_progress', project_id: 'pr1', assignee_ids: ['u1'] },
  { id: 's1', title: 'Already a subtask', status: 'pending', parent_task_id: 'p1' },
  { id: 'd1', title: 'Finished task', status: 'completed' },
];

describe('TaskForm subtask picker', () => {
  it('offers only open top-level tasks and submits the chosen parent', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async (p) => ({ id: 'new', ...p }));
    render(<TaskForm onSubmit={onSubmit} onClose={() => {}} parentOptions={tasks} />);
    const select = screen.getByLabelText('Subtask of (optional)');
    const labels = Array.from(select.querySelectorAll('option')).map((o) => o.textContent);
    expect(labels).toContain('Parent one');
    expect(labels).not.toContain('Already a subtask');
    expect(labels).not.toContain('Finished task');

    await user.selectOptions(select, 'p1');
    expect(screen.getByText('New subtask')).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('e.g. Prepare Q3 report'), 'Child');
    await user.click(screen.getByRole('button', { name: /create|add|save/i }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ title: 'Child', parent_task_id: 'p1', assignee_ids: ['u1'] }));
  });
});
