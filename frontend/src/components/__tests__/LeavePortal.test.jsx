import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
vi.mock('../../api', () => ({ default: { get: (...a) => get(...a), post: (...a) => post(...a), patch: (...a) => patch(...a), delete: vi.fn() } }));
vi.mock('../../AuthContext', () => ({ useAuth: () => ({ profile: { id: 'u1', full_name: 'Preet Mehta' } }) }));

import LeavePortal, { formatLeaveDate, leaveTypeLabel } from '../LeavePortal';

const row = (over = {}) => ({ id: 'r1', user_id: 'u1', employee_name: 'Preet Mehta', leave_type: 'sick', is_custom: false, duration: 'single', start_date: '2026-11-10', end_date: '2026-11-10', days: 1, reason: null, status: 'pending', reviewed_by_name: null, review_note: null, ...over });

beforeEach(() => { get.mockReset(); post.mockReset(); patch.mockReset(); });

describe('LeavePortal', () => {
  it('formats plain dates without a time-zone shift and labels custom types as typed', () => {
    expect(formatLeaveDate('2026-11-10')).toContain('10');
    expect(leaveTypeLabel(row())).toBe('Sick');
    expect(leaveTypeLabel(row({ leave_type: 'Wedding', is_custom: true }))).toBe('Wedding');
  });

  it('lists requests with their status, and lets an employee file a custom multi-day request', async () => {
    get.mockResolvedValue({ data: [row({ status: 'approved', reviewed_by_name: 'Naveena Shah' })] });
    post.mockResolvedValue({ data: row() });
    render(<LeavePortal />);
    expect(await screen.findByText('Approved by Naveena Shah')).toBeTruthy();

    fireEvent.click(screen.getByText('Request leave'));
    expect(screen.getByDisplayValue('Preet Mehta').readOnly).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Leave type' }));
    fireEvent.click(screen.getByRole('option', { name: /Custom/ }));
    fireEvent.change(screen.getByLabelText('Custom type'), { target: { value: 'Wedding' } });
    fireEvent.click(screen.getByText('Multiple days'));
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-12-01' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-12-03' } });
    fireEvent.click(screen.getByText('Submit request'));

    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][0]).toBe('/leaves');
    expect(post.mock.calls[0][1]).toMatchObject({ leave_type: 'custom', custom_type: 'Wedding', duration: 'multi', start_date: '2026-12-01', end_date: '2026-12-03' });
  });

  it('shows approve/reject only to admins', async () => {
    get.mockResolvedValue({ data: [row({ user_id: 'u2', employee_name: 'Meera Joshi' })] });
    const { unmount } = render(<LeavePortal isAdmin />);
    expect(await screen.findByText('Approve')).toBeTruthy();
    fireEvent.click(screen.getByText('Approve'));
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/leaves/r1', { status: 'approved' }));
    unmount();

    get.mockResolvedValue({ data: [row()] });
    render(<LeavePortal />);
    await screen.findByText('Cancel request');
    expect(screen.queryByText('Approve')).toBeNull();
  });
});
