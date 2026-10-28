import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const get = vi.fn();
const post = vi.fn();
vi.mock('../../api', () => ({ default: { get: (...a) => get(...a), post: (...a) => post(...a) } }));
let profile = { id: 'u1', org_id: 'o1', status: 'active' };
vi.mock('../../AuthContext', () => ({ useAuth: () => ({ profile }) }));

import PushPrompt from '../PushPrompt';

const subscribe = vi.fn(async () => ({ toJSON: () => ({ endpoint: 'https://push.test/abc', keys: { p256dh: 'p', auth: 'a' } }) }));
let existingSubscription = null;

function setupBrowser({ permission = 'default', subscribed = false } = {}) {
  existingSubscription = subscribed ? { endpoint: 'https://push.test/old' } : null;
  window.PushManager = function PushManager() {};
  window.Notification = { permission, requestPermission: vi.fn(async () => 'granted') };
  globalThis.Notification = window.Notification;
  const registration = { update: async () => {}, pushManager: { getSubscription: async () => existingSubscription, subscribe } };
  Object.defineProperty(window.navigator, 'serviceWorker', {
    configurable: true,
    value: { getRegistration: async () => registration, register: async () => registration, ready: Promise.resolve(registration) },
  });
}

async function showAfterDelay() {
  render(<PushPrompt />);
  await act(async () => { await vi.advanceTimersByTimeAsync(3500); });
}

describe('Turn on notifications pop-up', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
    window.localStorage.clear();
    profile = { id: 'u1', org_id: 'o1', status: 'active' };
    get.mockResolvedValue({ status: 200, data: { publicKey: 'BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' } });
    post.mockResolvedValue({ data: {} });
    setupBrowser();
  });
  afterEach(() => { vi.useRealTimers(); });

  it('appears a few seconds after sign-in when notifications can be turned on', async () => {
    await showAfterDelay();
    expect(screen.getByRole('dialog', { name: 'Turn on notifications' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Turn on' })).toBeTruthy();
  });

  it('turns notifications on: asks permission, subscribes the device and registers it with the server', async () => {
    await showAfterDelay();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Turn on' })); });
    expect(window.Notification.requestPermission).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/notifications/subscribe', expect.objectContaining({ endpoint: 'https://push.test/abc' }));
    expect(screen.getByText(/Notifications are on/)).toBeTruthy();
  });

  it('"Not now" hides it and keeps it away for a week', async () => {
    await showAfterDelay();
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(window.localStorage.getItem('taskflow:push-prompt-snoozed-at')).toBeTruthy();

    const { unmount } = render(<PushPrompt />);
    await act(async () => { await vi.advanceTimersByTimeAsync(3500); });
    expect(screen.queryByRole('dialog')).toBeNull();
    unmount();
  });

  it('stays hidden when the user already blocked notifications, or this device is already subscribed', async () => {
    setupBrowser({ permission: 'denied' });
    await showAfterDelay();
    expect(screen.queryByRole('dialog')).toBeNull();

    setupBrowser({ permission: 'granted', subscribed: true });
    await showAfterDelay();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('stays hidden when the server has no push keys, or the person is not set up yet', async () => {
    get.mockRejectedValue(Object.assign(new Error('503'), { response: { status: 503 } }));
    await showAfterDelay();
    expect(screen.queryByRole('dialog')).toBeNull();

    get.mockResolvedValue({ status: 200, data: { publicKey: 'abc' } });
    profile = { id: 'u2', org_id: null, status: 'needs_onboarding' };
    await showAfterDelay();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
