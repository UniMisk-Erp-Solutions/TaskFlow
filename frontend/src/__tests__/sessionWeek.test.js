import { describe, it, expect, beforeEach } from 'vitest';
import { sessionIdleExpired, touchSession, clearSessionActivity, SESSION_DAYS } from '../rememberMe';

const DAY = 24 * 60 * 60 * 1000;

describe('week-long session', () => {
  beforeEach(() => window.localStorage.clear());

  it('is one week', () => expect(SESSION_DAYS).toBe(7));

  it('is not expired when there is no record yet', () => {
    expect(sessionIdleExpired()).toBe(false);
  });

  it('stays signed in for 7 days of not opening the app, then asks again', () => {
    const t0 = Date.UTC(2026, 10, 27);
    touchSession(t0);
    expect(sessionIdleExpired(t0 + 6 * DAY)).toBe(false);
    expect(sessionIdleExpired(t0 + 8 * DAY)).toBe(true);
  });

  it('each visit renews the week', () => {
    const t0 = Date.UTC(2026, 10, 27);
    touchSession(t0);
    touchSession(t0 + 5 * DAY);
    expect(sessionIdleExpired(t0 + 10 * DAY)).toBe(false);
  });

  it('clears the record on sign-out', () => {
    touchSession(Date.UTC(2026, 10, 1));
    clearSessionActivity();
    expect(sessionIdleExpired(Date.UTC(2026, 11, 1))).toBe(false);
  });
});
