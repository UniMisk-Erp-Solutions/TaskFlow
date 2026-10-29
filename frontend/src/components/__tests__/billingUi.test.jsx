import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const auth = { user: { id: 'u1' }, signOut: vi.fn() };
const billingState = { billing: null, refresh: vi.fn(), checkout: vi.fn(), startTrial: vi.fn() };
const post = vi.fn();

vi.mock('../../AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../BillingContext', () => ({ useBilling: () => billingState }));
vi.mock('../../api', () => ({ default: { post: (...a) => post(...a), get: vi.fn() } }));

import SubscriptionGate from '../SubscriptionGate';
import BusinessInquiryModal, { validateBusinessForm } from '../../landing/components/BusinessInquiryModal';

const lockedAdmin = { locked: true, canManageBilling: true, lastPayment: null };

function gate(path = '/admin/tasks') {
  return render(<MemoryRouter initialEntries={[path]}><SubscriptionGate /></MemoryRouter>);
}

beforeEach(() => {
  auth.user = { id: 'u1' };
  billingState.billing = null;
  billingState.checkout = vi.fn();
  billingState.refresh = vi.fn();
  post.mockReset();
});

describe('payment popup', () => {
  it('shows nothing for a signed-out visitor, an unlocked workspace or before the status has loaded', () => {
    auth.user = null;
    billingState.billing = lockedAdmin;
    expect(gate().container).toBeEmptyDOMElement();
    auth.user = { id: 'u1' };
    billingState.billing = { ...lockedAdmin, locked: false };
    expect(gate().container).toBeEmptyDOMElement();
    billingState.billing = null;
    expect(gate().container).toBeEmptyDOMElement();
  });

  it('blocks the app screens when the server reports the workspace as locked, and has no way to dismiss it', () => {
    billingState.billing = lockedAdmin;
    gate();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('heading', { name: /trial has ended/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /close|dismiss|later/i })).toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does not cover the public pages', () => {
    billingState.billing = lockedAdmin;
    expect(gate('/pricing').container).toBeEmptyDOMElement();
  });

  it('lets a non-admin know to ask their admin, with no pay button', () => {
    billingState.billing = { ...lockedAdmin, canManageBilling: false };
    gate();
    expect(screen.queryByRole('button', { name: /subscribe to pro/i })).toBeNull();
    expect(screen.getByText(/ask your workspace admin/i)).toBeInTheDocument();
  });

  it('shows the server message when payments are not switched on, and never pretends to succeed', async () => {
    billingState.billing = lockedAdmin;
    billingState.checkout = vi.fn().mockResolvedValue({ ok: false, error: 'Online payments are not switched on yet.' });
    gate();
    fireEvent.click(screen.getByRole('button', { name: /subscribe to pro/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('not switched on yet');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('explains a failed or cancelled last payment', () => {
    billingState.billing = { ...lockedAdmin, lastPayment: { status: 'failed', failure_reason: 'card declined' } };
    gate();
    expect(screen.getByRole('status')).toHaveTextContent(/failed.*card declined/i);
  });
});

describe('Business enquiry form', () => {
  const fill = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

  it('validates every required field before sending', async () => {
    render(<BusinessInquiryModal onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /send request/i }));
    expect((await screen.findAllByRole('alert')).length).toBeGreaterThanOrEqual(6);
    expect(post).not.toHaveBeenCalled();
  });

  it('asks for a phone number when a call or WhatsApp is chosen', () => {
    const base = { name: 'Asha', work_email: 'a@b.com', company: 'Co', job_title: 'CEO', team_size: '1-10', requirements: 'long enough text', required_features: [], contact_method: 'whatsapp', phone: '', budget: '', message: '', website: '' };
    expect(validateBusinessForm(base).phone).toBeTruthy();
    expect(validateBusinessForm({ ...base, phone: '+91 98765 43210' })).toEqual({});
  });

  it('sends the completed form to the API and confirms', async () => {
    post.mockResolvedValue({ data: { ok: true } });
    render(<BusinessInquiryModal onClose={() => {}} />);
    fill('Name', 'Asha Patel');
    fill('Work email', 'asha@example.com');
    fill('Company', 'Example Pvt Ltd');
    fill('Job title', 'Operations Head');
    fill('Team size', '51-200');
    fill('What do you need?', 'We need manager approvals and a leave portal.');
    fireEvent.click(screen.getByLabelText('Leave portal'));
    fireEvent.click(screen.getByRole('button', { name: /send request/i }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    const [url, body] = post.mock.calls[0];
    expect(url).toBe('/public/business-inquiry');
    expect(body).toMatchObject({ work_email: 'asha@example.com', team_size: '51-200', required_features: ['Leave portal'], contact_method: 'email', website: '' });
    expect(await screen.findByText(/we have your request/i)).toBeInTheDocument();
  });

  it('shows the server error when the request is refused', async () => {
    post.mockRejectedValue({ response: { data: { error: 'Too many requests right now.' } } });
    render(<BusinessInquiryModal onClose={() => {}} />);
    fill('Name', 'Asha Patel');
    fill('Work email', 'asha@example.com');
    fill('Company', 'Example Pvt Ltd');
    fill('Job title', 'Operations Head');
    fill('Team size', '1-10');
    fill('What do you need?', 'We need manager approvals and a leave portal.');
    fireEvent.click(screen.getByRole('button', { name: /send request/i }));
    expect(await screen.findByText(/too many requests/i)).toBeInTheDocument();
  });
});
