import { describe, it, expect, beforeEach } from 'vitest';
import { getRememberMe, setRememberMe, getRememberedEmail, rememberEmail, sessionStorageAdapter } from '../../rememberMe';

beforeEach(() => { window.localStorage.clear(); window.sessionStorage.clear(); });

describe('remember me', () => {
  it('is on by default and keeps the session in localStorage', () => {
    expect(getRememberMe()).toBe(true);
    sessionStorageAdapter.setItem('sb-session', 'abc');
    expect(window.localStorage.getItem('sb-session')).toBe('abc');
    expect(window.sessionStorage.getItem('sb-session')).toBeNull();
  });

  it('keeps the session only until the browser closes when it is turned off', () => {
    setRememberMe(false);
    sessionStorageAdapter.setItem('sb-session', 'abc');
    expect(window.sessionStorage.getItem('sb-session')).toBe('abc');
    expect(window.localStorage.getItem('sb-session')).toBeNull();
    expect(sessionStorageAdapter.getItem('sb-session')).toBe('abc');
  });

  it('moves an existing session across when the choice changes, and removes it from both places', () => {
    sessionStorageAdapter.setItem('sb-session', 'one');
    setRememberMe(false);
    sessionStorageAdapter.setItem('sb-session', 'two');
    expect(window.localStorage.getItem('sb-session')).toBeNull();
    expect(sessionStorageAdapter.getItem('sb-session')).toBe('two');
    sessionStorageAdapter.removeItem('sb-session');
    expect(sessionStorageAdapter.getItem('sb-session')).toBeNull();
  });

  it('remembers the email only while it is ticked', () => {
    rememberEmail('me@work.com', true);
    expect(getRememberedEmail()).toBe('me@work.com');
    setRememberMe(false);
    expect(getRememberedEmail()).toBe('');
    setRememberMe(true);
    rememberEmail('me@work.com', false);
    expect(getRememberedEmail()).toBe('');
  });
});
