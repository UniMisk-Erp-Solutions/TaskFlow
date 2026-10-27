// Web push for this browser/device: is it possible, is it already on, and turning it on.
// The Notifications tab and the "Turn on notifications" pop-up both use this.

export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

function isIos() {
  const ua = window.navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && window.navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

/**
 * 'unsupported' – this browser can't do web push (on iPhone/iPad only the installed app can)
 * 'denied'      – the user blocked notifications in the browser settings; a page can't change that
 * 'on'          – allowed and this device is subscribed
 * 'off'         – can be turned on
 */
export async function pushDeviceState() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') return 'unsupported';
  if (isIos() && !isStandalone()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (sub && Notification.permission === 'granted') return 'on';
  } catch { /* treat as off */ }
  return 'off';
}

/** Asks permission (must run from a tap/click) and subscribes this device. Returns 'granted' or the refused permission. */
export async function enablePushOnThisDevice(api) {
  const vapidRes = await api.get('/notifications/vapid-public-key');
  const key = vapidRes.data?.publicKey;
  if (!key) throw new Error('Push is not configured on the server.');
  let reg = await navigator.serviceWorker.getRegistration('/');
  if (!reg) {
    await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    reg = await navigator.serviceWorker.ready;
  } else {
    await reg.update();
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission;
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key),
  });
  await api.post('/notifications/subscribe', subscription.toJSON());
  return 'granted';
}
