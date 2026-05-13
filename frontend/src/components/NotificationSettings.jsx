import React, { useCallback, useEffect, useState } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import api from '../api';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export default function NotificationSettings() {
  const [prefs, setPrefs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [perm, setPerm] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
  );
  const [vapidUnavailable, setVapidUnavailable] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const prefsRes = await api.get('/notifications/preferences');
      setPrefs(prefsRes.data);
    } catch (e) {
      setErr(e.response?.data?.error || e.message || 'Could not load preferences');
      setPrefs(null);
    }
    try {
      const vapidRes = await api.get('/notifications/vapid-public-key');
      setVapidUnavailable(vapidRes.status === 503 || !vapidRes.data?.publicKey);
    } catch {
      setVapidUnavailable(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function patchPrefs(partial) {
    setBusy(true);
    setErr('');
    try {
      const { data } = await api.patch('/notifications/preferences', partial);
      setPrefs(data);
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  }

  async function enableThisDevice() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setErr('This browser does not support web push.');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const vapidRes = await api.get('/notifications/vapid-public-key');
      const key = vapidRes.data?.publicKey;
      if (!key) throw new Error('Push is not configured on the server.');
      let reg = await navigator.serviceWorker.getRegistration('/');
      if (!reg) {
        await navigator.serviceWorker.register('/sw-push.js', { scope: '/' });
        reg = await navigator.serviceWorker.ready;
      } else {
        await reg.update();
      }
      const permission = await Notification.requestPermission();
      setPerm(permission);
      if (permission !== 'granted') {
        setBusy(false);
        return;
      }
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
      await api.post('/notifications/subscribe', subscription.toJSON());
      await reload();
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  }

  async function disableThisDevice() {
    setBusy(true);
    setErr('');
    try {
      const reg = await navigator.serviceWorker.getRegistration('/');
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      const endpoint = sub?.endpoint || null;
      if (sub) await sub.unsubscribe();
      await api.post('/notifications/unsubscribe', endpoint ? { endpoint } : {});
      await reload();
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  }

  const rowStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: '14px 0',
    borderBottom: '1px solid var(--tf-border)',
  };

  const labelStyle = { fontSize: 15, fontWeight: 500, color: 'var(--tf-text)' };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 24 }}>
        <Loader2 className="spinner" size={22} />
        <span style={{ color: 'var(--tf-muted)' }}>Loading notification settings…</span>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, marginBottom: 8 }}>
        Notifications
      </h2>
      <p style={{ fontSize: 14, color: 'var(--tf-muted)', marginBottom: 28, lineHeight: 1.5 }}>
        Get alerts on this device when you are assigned tasks or meetings, or when their status changes. Works in
        supported desktop and mobile browsers (HTTPS or localhost).
      </p>

      {err && (
        <div
          role="alert"
          style={{
            marginBottom: 20,
            padding: '12px 14px',
            borderRadius: 10,
            background: 'rgba(248,113,113,0.08)',
            border: '1px solid rgba(248,113,113,0.2)',
            color: 'var(--status-danger)',
            fontSize: 14,
          }}
        >
          {err}
        </div>
      )}

      <div style={{ ...rowStyle, borderBottom: 'none', flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bell size={17} strokeWidth={1.75} />
            Push on this device
          </div>
          <div style={{ fontSize: 13, color: 'var(--tf-muted)', marginTop: 4, maxWidth: 420 }}>
            Browser permission required. Backend must expose VAPID keys.
            {vapidUnavailable ? ' Push API returned no public key.' : ''}
          </div>
          <div style={{ fontSize: 13, color: 'var(--tf-muted)', marginTop: 8 }}>
            Permission:{' '}
            <strong>{perm === 'unsupported' ? 'not available in this browser' : perm}</strong>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={busy || vapidUnavailable}
            onClick={() => enableThisDevice()}
          >
            {busy ? <Loader2 className="spinner" size={14} /> : <Bell size={14} />}
            Enable here
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => disableThisDevice()}>
            <BellOff size={14} />
            Disable here
          </button>
        </div>
      </div>

      <ToggleRow
        label="Task assignments"
        hint="Notify when someone adds you as an assignee (new task or updated roster)."
        checked={prefs?.notify_task_assigned !== false}
        disabled={busy}
        onChange={(v) => patchPrefs({ notify_task_assigned: v })}
      />
      <ToggleRow
        label="Meeting assignments"
        hint="Notify when someone adds you to a meeting roster."
        checked={prefs?.notify_meeting_assigned !== false}
        disabled={busy}
        onChange={(v) => patchPrefs({ notify_meeting_assigned: v })}
      />
      <ToggleRow
        label="Task updates"
        hint="Notify when someone changes task status."
        checked={prefs?.notify_task_updates !== false}
        disabled={busy}
        onChange={(v) => patchPrefs({ notify_task_updates: v })}
      />
      <ToggleRow
        label="Meeting updates"
        hint="Notify when someone changes meeting status."
        checked={prefs?.notify_meeting_updates !== false}
        disabled={busy}
        onChange={(v) => patchPrefs({ notify_meeting_updates: v })}
        last
      />

      <p style={{ fontSize: 12, color: 'var(--tf-muted)', marginTop: 28, lineHeight: 1.55 }}>
        Turning off a category stops those notifications. Disable on this device removes the browser subscription only.
      </p>
    </div>
  );
}

function ToggleRow({ label, hint, checked, disabled, onChange, last }) {
  return (
    <div style={{ ...rowStyle, borderBottom: last ? 'none' : rowStyle.borderBottom }}>
      <div>
        <div style={labelStyle}>{label}</div>
        <div style={{ fontSize: 13, color: 'var(--tf-muted)', marginTop: 4, maxWidth: 460 }}>{hint}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        style={{
          width: 52,
          height: 28,
          borderRadius: 999,
          border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          background: checked ? 'var(--color-primary)' : 'var(--tf-border)',
          flexShrink: 0,
          position: 'relative',
          transition: 'background 140ms ease',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 3,
            left: checked ? 26 : 3,
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,.2)',
            transition: 'left 140ms ease',
          }}
        />
      </button>
    </div>
  );
}
