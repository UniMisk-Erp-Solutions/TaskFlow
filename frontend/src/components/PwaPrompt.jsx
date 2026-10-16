import React, { useCallback, useEffect, useState } from 'react';
import { Download, RefreshCw, Share, SquarePlus, WifiOff, X } from 'lucide-react';
import { useAuth } from '../AuthContext';

const DISMISS_KEY = 'taskflow:pwa-install-dismissed-at';
const DISMISS_DAYS = 14;

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isIos() {
  const ua = window.navigator.userAgent;
  const iPadOs = ua.includes('Macintosh') && window.navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/.test(ua) || iPadOs;
}

function recentlyDismissed() {
  try {
    const at = Number(window.localStorage.getItem(DISMISS_KEY));
    return at && Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

const card = {
  position: 'fixed',
  left: 12,
  right: 12,
  bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
  zIndex: 9000,
  maxWidth: 440,
  margin: '0 auto',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 14px',
  borderRadius: 16,
  background: 'var(--tf-panel)',
  color: 'var(--tf-text)',
  border: '1px solid var(--tf-border)',
  boxShadow: '0 12px 32px rgba(10,21,48,0.22)',
  fontSize: 14,
};

/**
 * PWA helpers: install banner (Android/desktop prompt, iOS "Add to Home Screen" steps),
 * "new version available" toast and an offline strip. Install nudges only appear after sign-in.
 */
export default function PwaPrompt() {
  const { user } = useAuth();
  const [installEvent, setInstallEvent] = useState(null);
  const [iosHint, setIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(() => (typeof window === 'undefined' ? true : recentlyDismissed()));
  const [installed, setInstalled] = useState(() => (typeof window === 'undefined' ? false : isStandalone()));
  const [updateReg, setUpdateReg] = useState(null);
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false);

  useEffect(() => {
    const onPrompt = (event) => {
      event.preventDefault();
      setInstallEvent(event);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };
    const onUpdate = (event) => setUpdateReg(event.detail);
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    window.addEventListener('taskflow:sw-update', onUpdate);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    if (isIos() && !isStandalone()) setIosHint(true);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      window.removeEventListener('taskflow:sw-update', onUpdate);
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try { window.localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* storage unavailable */ }
  }, []);

  async function install() {
    if (!installEvent) return;
    installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    setInstallEvent(null);
    if (outcome === 'dismissed') dismiss();
  }

  function applyUpdate() {
    if (!updateReg?.waiting) { window.location.reload(); return; }
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
    updateReg.waiting.postMessage({ type: 'SKIP_WAITING' });
  }

  const canNudge = Boolean(user) && !installed && !dismissed && !updateReg;

  return (
    <>
      {offline && (
        <div
          role="status"
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9100, padding: '6px 12px',
            paddingTop: 'calc(6px + env(safe-area-inset-top, 0px))', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 8, background: 'var(--status-danger, #c0392b)', color: '#fff', fontSize: 13, fontWeight: 600,
          }}
        >
          <WifiOff size={14} /> You're offline — changes won't sync until you reconnect.
        </div>
      )}

      {updateReg && (
        <div role="alert" style={card}>
          <RefreshCw size={20} color="var(--color-primary)" />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>A new version of TaskFlow is ready</div>
            <div style={{ color: 'var(--tf-muted)', fontSize: 13 }}>Reload to get the latest features.</div>
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={applyUpdate}>Update</button>
        </div>
      )}

      {canNudge && installEvent && (
        <div role="dialog" aria-label="Install TaskFlow" style={card}>
          <img src="/icons/icon-192.png" alt="" width={40} height={40} style={{ borderRadius: 10, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>Install TaskFlow</div>
            <div style={{ color: 'var(--tf-muted)', fontSize: 13 }}>Open it like an app, straight from your home screen.</div>
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={install}><Download size={14} /> Install</button>
          <button type="button" aria-label="Not now" onClick={dismiss} style={{ border: 'none', background: 'transparent', color: 'var(--tf-muted)', cursor: 'pointer' }}><X size={16} /></button>
        </div>
      )}

      {canNudge && !installEvent && iosHint && (
        <div role="dialog" aria-label="Install TaskFlow on iPhone or iPad" style={{ ...card, alignItems: 'flex-start' }}>
          <img src="/icons/icon-192.png" alt="" width={40} height={40} style={{ borderRadius: 10, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>Install TaskFlow on your iPhone</div>
            <div style={{ color: 'var(--tf-muted)', fontSize: 13, lineHeight: 1.5, marginTop: 2 }}>
              Tap <Share size={13} style={{ verticalAlign: '-2px' }} /> <b>Share</b>, then <SquarePlus size={13} style={{ verticalAlign: '-2px' }} /> <b>Add to Home Screen</b>.
            </div>
          </div>
          <button type="button" aria-label="Close" onClick={dismiss} style={{ border: 'none', background: 'transparent', color: 'var(--tf-muted)', cursor: 'pointer' }}><X size={16} /></button>
        </div>
      )}
    </>
  );
}
