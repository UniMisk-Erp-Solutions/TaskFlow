import React, { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import api from '../api';
import { useAuth } from '../AuthContext';
import { enablePushOnThisDevice, pushDeviceState } from '../lib/pushDevice';

const SNOOZE_KEY = 'taskflow:push-prompt-snoozed-at';
const SNOOZE_DAYS = 7;
const SHOW_AFTER_MS = 3000; // let the page settle first

function snoozed() {
  try {
    const at = Number(window.localStorage.getItem(SNOOZE_KEY));
    return !!at && Date.now() - at < SNOOZE_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function snooze() {
  try { window.localStorage.setItem(SNOOZE_KEY, String(Date.now())); } catch { /* storage unavailable */ }
}

/**
 * Asks signed-in people to turn on push notifications, once, as a small card at the top of the screen. It only appears when
 * turning them on can actually work (supported, not blocked, server configured, not already on) and "Not now" hides it for a week.
 */
export default function PushPrompt() {
  const { profile } = useAuth();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const ready = !!profile?.id && !!profile?.org_id && (profile?.status ?? 'active') === 'active';

  useEffect(() => {
    if (!ready || snoozed()) return undefined;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        if ((await pushDeviceState()) !== 'off') return;
        const res = await api.get('/notifications/vapid-public-key'); // is push set up on the server?
        if (!res.data?.publicKey) return;
        if (!cancelled) setVisible(true);
      } catch { /* server without push: stay quiet */ }
    }, SHOW_AFTER_MS);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [ready, profile?.id]);

  if (!visible) return null;

  async function turnOn() {
    setBusy(true);
    setMessage('');
    try {
      const result = await enablePushOnThisDevice(api);
      if (result === 'granted') {
        setMessage('Notifications are on. You will be alerted when a task is assigned to you.');
        window.setTimeout(() => setVisible(false), 3500);
      } else {
        snooze();
        setMessage('Notifications are blocked for this site. You can allow them in your browser settings.');
        window.setTimeout(() => setVisible(false), 5000);
      }
    } catch (err) {
      setMessage(err.response?.data?.error || err.message || 'Could not turn notifications on.');
    } finally {
      setBusy(false);
    }
  }

  function notNow() {
    snooze();
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Turn on notifications"
      style={{
        position: 'fixed', left: 12, right: 12, top: 'calc(12px + env(safe-area-inset-top, 0px))', zIndex: 9000,
        maxWidth: 440, margin: '0 auto', display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', borderRadius: 16,
        background: 'var(--tf-panel)', border: '1px solid var(--tf-border)', boxShadow: '0 12px 32px rgba(0,0,0,0.3)',
      }}
    >
      <span style={{ display: 'grid', placeItems: 'center', width: 36, height: 36, borderRadius: 12, background: 'var(--color-primary)', color: 'var(--color-on-primary, #fff)', flexShrink: 0 }}>
        <Bell size={18} />
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--tf-text)' }}>Turn on notifications?</div>
        <div style={{ fontSize: 13, color: 'var(--tf-muted)', marginTop: 2 }}>
          {message || 'Get an alert on this device when a task or meeting is assigned to you.'}
        </div>
        {!message.startsWith('Notifications are') && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={turnOn} disabled={busy}>{busy ? <span className="spinner" /> : 'Turn on'}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={notNow} disabled={busy}>Not now</button>
          </div>
        )}
      </div>
      <button type="button" aria-label="Dismiss" onClick={notNow} style={{ border: 0, background: 'transparent', color: 'var(--tf-muted)', cursor: 'pointer', padding: 4 }}><X size={16} /></button>
    </div>
  );
}
