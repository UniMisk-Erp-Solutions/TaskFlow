/**
 * ============================================================================
 *  <MaintenanceGate> — drop-in maintenance switch for a React app
 * ============================================================================
 *  WHAT IT DOES
 *    Asks the CLOUD maintenance project "is <projectKey> in maintenance?".
 *    - live        -> renders your app exactly as before
 *    - maintenance -> renders a static maintenance screen on the SAME domain
 *
 *  SAFETY PROPERTIES (by construction)
 *    * Reads ONE public table (status) in a SEPARATE cloud Supabase project.
 *      It never touches this app's own backend/database.
 *    * Uses plain fetch(), NOT supabase-js, so it cannot collide with your
 *      app's existing Supabase client, auth session or localStorage keys.
 *    * FAIL-OPEN: any error, timeout, or unknown key renders the app.
 *      A monitoring outage can never black out your site.
 *    * The maintenance screen is static: it makes zero backend calls.
 *    * Nothing is ever written. This component only ever does GET.
 *
 *  USAGE (main.jsx)
 *      import MaintenanceGate from "./MaintenanceGate";
 *      <MaintenanceGate projectKey="taskflow"><App /></MaintenanceGate>
 *
 *  ENV (.env)  — both are PUBLIC values, safe to ship
 *      VITE_STATUS_URL=https://qknaxyagucgepawvrgto.supabase.co
 *      VITE_STATUS_KEY=<anon public key of the maintenance project>
 * ============================================================================
 */
import { useEffect, useRef, useState } from "react";

const STATUS_URL = import.meta.env.VITE_STATUS_URL;
const STATUS_KEY = import.meta.env.VITE_STATUS_KEY;

const FIRST_CHECK_TIMEOUT = 1500; // ms to wait before giving up and showing the app
const POLL_MS = 30000;            // re-check every 30s while the tab is open

async function fetchStatus(projectKey, signal) {
  if (!STATUS_URL || !STATUS_KEY) return null;      // not configured -> fail open
  const url =
    `${STATUS_URL.replace(/\/$/, "")}/rest/v1/status` +
    `?key=eq.${encodeURIComponent(projectKey)}` +
    `&select=status,message,eta,display_name`;
  const r = await fetch(url, {
    signal,
    headers: { apikey: STATUS_KEY, Authorization: `Bearer ${STATUS_KEY}` },
  });
  if (!r.ok) return null;                            // any error -> fail open
  const rows = await r.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

export default function MaintenanceGate({ projectKey, children, fallbackTitle }) {
  const [state, setState] = useState({ checked: false, row: null });
  const timer = useRef(null);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();

    // Hard cap on the very first check so the app can never be blocked.
    const giveUp = setTimeout(() => {
      if (alive) setState((s) => (s.checked ? s : { checked: true, row: null }));
    }, FIRST_CHECK_TIMEOUT);

    const check = async () => {
      try {
        const row = await fetchStatus(projectKey, controller.signal);
        if (alive) setState({ checked: true, row });
      } catch {
        if (alive) setState({ checked: true, row: null });   // fail open
      }
    };

    check();
    timer.current = setInterval(check, POLL_MS);
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);

    return () => {
      alive = false;
      controller.abort();
      clearTimeout(giveUp);
      clearInterval(timer.current);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
    };
  }, [projectKey]);

  // Before the first answer, show a neutral splash (never the app, never an
  // error) for at most FIRST_CHECK_TIMEOUT, so we don't flash the landing page.
  if (!state.checked) return <Splash />;

  if (state.row?.status === "maintenance") {
    return (
      <MaintenanceScreen
        title={state.row.display_name || fallbackTitle || "This service"}
        message={state.row.message}
        eta={state.row.eta}
      />
    );
  }
  return children;
}

/* ------------------------------ neutral splash ----------------------------- */
function Splash() {
  return (
    <div style={S.splash}>
      <div style={S.spinner} />
      <style>{"@keyframes mcspin{to{transform:rotate(360deg)}}"}</style>
    </div>
  );
}

/* --------------------------- maintenance screen ---------------------------- *
 * Deliberately static: no images, no fonts, no network calls of any kind.
 * -------------------------------------------------------------------------- */
export function MaintenanceScreen({ title, message, eta }) {
  const etaText = eta
    ? new Date(eta).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : null;

  return (
    <div style={S.wrap}>
      <div style={S.card}>
        <div style={S.icon} aria-hidden="true">🛠️</div>
        <h1 style={S.h1}>We&rsquo;ll be right back</h1>
        <p style={S.p}>
          {message || `${title} is temporarily unavailable while we carry out maintenance. Your data is safe — nothing has been lost.`}
        </p>
        {etaText && (
          <p style={S.eta}>
            Expected back around <strong style={{ color: "#e6edf3" }}>{etaText}</strong>
          </p>
        )}
        <button style={S.btn} onClick={() => window.location.reload()}>Try again</button>
        <p style={S.foot}>This page refreshes automatically when the service is restored.</p>
      </div>
    </div>
  );
}

/* --------------------------------- styles ---------------------------------- */
const S = {
  splash: {
    minHeight: "100vh", display: "grid", placeItems: "center",
    background: "#0b0f17",
  },
  spinner: {
    width: 26, height: 26, borderRadius: "50%",
    border: "2.5px solid #1e2733", borderTopColor: "#2f81f7",
    animation: "mcspin .7s linear infinite",
  },
  wrap: {
    minHeight: "100vh", display: "grid", placeItems: "center", padding: 20,
    background: "#0b0f17", color: "#e6edf3",
    font: "15px/1.6 system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  },
  card: {
    maxWidth: 460, width: "100%", textAlign: "center",
    background: "#111826", border: "1px solid #1e2733",
    borderRadius: 18, padding: "38px 30px",
  },
  icon: { fontSize: 42, lineHeight: 1, marginBottom: 6 },
  h1: { fontSize: 22, margin: "10px 0 6px", fontWeight: 700 },
  p: { color: "#8b98a9", margin: "0 0 4px" },
  eta: { color: "#8b98a9", marginTop: 14, fontSize: 14 },
  btn: {
    marginTop: 22, padding: "10px 20px", borderRadius: 10, border: 0,
    background: "#2f81f7", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
  },
  foot: { color: "#5b6675", fontSize: 12.5, marginTop: 18, marginBottom: 0 },
};
