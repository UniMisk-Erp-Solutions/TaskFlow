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

  it('summarises leave per employee for admins and filters by month, type and person', async () => {
    get.mockResolvedValue({ data: [
      row({ id: 'a', user_id: 'u1', employee_name: 'Preet Mehta', leave_type: 'sick', duration: 'multi', start_date: '2026-10-05', end_date: '2026-10-06', days: 2, status: 'approved' }),
      row({ id: 'b', user_id: 'u1', employee_name: 'Preet Mehta', leave_type: 'half day', start_date: '2026-10-10', end_date: '2026-10-10', status: 'approved' }),
      row({ id: 'c', user_id: 'u2', employee_name: 'Meera Joshi', leave_type: 'exam', start_date: '2026-11-02', end_date: '2026-11-02', status: 'approved' }),
      row({ id: 'd', user_id: 'u2', employee_name: 'Meera Joshi', leave_type: 'trip', start_date: '2026-11-20', end_date: '2026-11-20', status: 'pending' }),
    ] });
    const { container } = render(<LeavePortal isAdmin />);
    await screen.findByText('Approve'); // list loaded
    fireEvent.click(screen.getByRole('button', { name: /Summary/ }));

    const tiles = () => [...container.querySelectorAll('.tf-ls-tiles b')].map((b) => b.textContent);
    expect(tiles()).toEqual(['3', '3.5', '2']); // approved only: 3 requests, 2 + 0.5 + 1 days, 2 people
    expect(screen.getByText('Preet Mehta').closest('article').textContent).toMatch(/2 requests · 2\.5 days/);

    fireEvent.click(screen.getByRole('button', { name: 'Filter by month' }));
    fireEvent.click(screen.getByRole('option', { name: 'October 2026' }));
    expect(tiles()).toEqual(['2', '2.5', '1']);

    fireEvent.click(screen.getByRole('button', { name: 'Filter by leave type' }));
    fireEvent.click(screen.getByRole('option', { name: 'Half day' }));
    expect(tiles()).toEqual(['1', '0.5', '1']);

    fireEvent.click(screen.getByRole('button', { name: 'Which requests to count' }));
    fireEvent.click(screen.getByRole('option', { name: 'All requests' }));
    fireEvent.click(screen.getByRole('button', { name: 'Filter by month' }));
    fireEvent.click(screen.getByRole('option', { name: 'All time' }));
    fireEvent.click(screen.getByRole('button', { name: 'Filter by leave type' }));
    fireEvent.click(screen.getByRole('option', { name: 'Trip' }));
    expect(tiles()).toEqual(['1', '1', '1']); // the pending trip now counts
  });

  it('only offers the summary to admins and managers', async () => {
    get.mockResolvedValue({ data: [row()] });
    const { unmount } = render(<LeavePortal />);
    await screen.findByText('Cancel request');
    expect(screen.queryByRole('button', { name: /Summary/ })).toBeNull();
    unmount();
    render(<LeavePortal canSummary />);
    await screen.findByText('Cancel request');
    expect(screen.getByRole('button', { name: /Summary/ })).toBeTruthy();
  });

  it('shows leave on the calendar and lists a day\'s requests when it is tapped', async () => {
    const d = new Date();
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    get.mockResolvedValue({ data: [row({ leave_type: 'late coming', start_date: iso, end_date: iso, reason: 'Traffic' })] });
    render(<LeavePortal />);
    await screen.findByText('Cancel request'); // list view first
    fireEvent.click(screen.getByRole('button', { name: /Calendar/ }));

    expect(screen.queryByText('Cancel request')).toBeNull(); // cards only appear once a day is picked
    expect(screen.getByTitle(/Late coming \(Pending\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole('gridcell', { name: new RegExp(`^${d.getDate()} .*1 leave request`) }));
    expect(await screen.findByText('Traffic')).toBeTruthy();
    expect(screen.getByText('Cancel request')).toBeTruthy();
  });
});
