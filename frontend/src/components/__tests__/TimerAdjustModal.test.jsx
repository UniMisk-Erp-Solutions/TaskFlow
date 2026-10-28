import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TimerAdjustModal from '../TimerAdjustModal';

const hourAgo = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
const session = { id: 's1', task_id: 't1', user_id: 'u1', started_at: hourAgo, ended_at: null };
const task = { id: 't1', title: 'Servicewise bugs' };

describe('TimerAdjustModal', () => {
  it('saves the chosen end time for the session', async () => {
    const onSave = vi.fn(async () => ({}));
    const onClose = vi.fn();
    render(<TimerAdjustModal task={task} session={session} onClose={onClose} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: /−30 min/ }));
    fireEvent.change(screen.getByLabelText('Reason (optional)'), { target: { value: 'forgot to pause' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save time' }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const payload = onSave.mock.calls[0][0];
    expect(payload.session_id).toBe('s1');
    expect(payload.reason).toBe('forgot to pause');
    expect(Date.parse(payload.ended_at)).toBeLessThan(Date.now() - 25 * 60 * 1000);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('blocks an end time before the timer started', () => {
    render(<TimerAdjustModal task={task} session={session} onClose={() => {}} onSave={vi.fn()} />);
    const early = new Date(Date.now() - 5 * 3600 * 1000);
    const pad = (n) => String(n).padStart(2, '0');
    const v = `${early.getFullYear()}-${pad(early.getMonth() + 1)}-${pad(early.getDate())}T${pad(early.getHours())}:${pad(early.getMinutes())}`;
    fireEvent.change(screen.getByLabelText('Work ended at'), { target: { value: v } });
    expect(screen.getByText('The end time cannot be before the timer started.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save time' }).disabled).toBe(true);
  });
});
