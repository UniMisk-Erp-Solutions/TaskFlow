/**
 * ============================================================================
 *  <MaintenanceGate> — drop-in maintenance switch for a React app
 * ============================================================================
 *  WHAT IT DOES
 *    Asks the CLOUD maintenance project "is <projectKey> in maintenance?".
 *      live        -> renders your app exactly as before
 *      maintenance -> renders a static maintenance screen on the SAME domain
 *
 *  WHICH PAGES ARE AFFECTED
 *    By default every route is gated. Use `publicPaths` to keep marketing and
 *    other backend-free pages reachable while the app is down:
 *
 *      <MaintenanceGate projectKey="taskflow" publicPaths={["/", "/about", "/legal/*"]}>
 *
 *    Anything NOT listed is gated — which deliberately includes /login and
 *    /signup, because signing in needs the backend that is down.
 *    Alternatively pass `protectedPaths` to gate ONLY those routes; when it is
 *    supplied it takes precedence and every other route stays reachable.
 *
 *    Route changes are picked up automatically, SPA navigation included.
 *
 *  SAFETY PROPERTIES (by construction)
 *    * Reads ONE public table (status) in a SEPARATE cloud Supabase project.
 *      It never touches this app's own backend/database.
 *    * Uses plain fetch(), NOT supabase-js, so it cannot collide with your
 *      app's existing Supabase client, auth session or localStorage keys.
 *    * FAIL-OPEN: any error, timeout, or unknown key renders the app.
 *      A monitoring outage can never black out your site.
 *    * The maintenance screen is static: no images, icons, webfonts or calls.
 *    * Nothing is ever written. This component only ever does GET.
 *
 *  USAGE (main.jsx) — keep it as the OUTERMOST wrapper: outside the router,
 *  query client, auth provider and theme provider.
 *      import MaintenanceGate from "./MaintenanceGate";
 *      <MaintenanceGate projectKey="taskflow" publicPaths={["/"]}>
 *        <App />
 *      </MaintenanceGate>
 *
 *  ENV (.env) — both are PUBLIC values, safe to ship
 *      VITE_STATUS_URL=https://qknaxyagucgepawvrgto.supabase.co
 *      VITE_STATUS_KEY=<anon public key of the maintenance project>
 * ============================================================================
 */
import { useEffect, useRef, useState } from "react";

const STATUS_URL = import.meta.env.VITE_STATUS_URL;
const STATUS_KEY = import.meta.env.VITE_STATUS_KEY;

const FIRST_CHECK_TIMEOUT = 1500; // ms before we give up and show the app
const POLL_MS = 30000;            // re-check cadence while the tab is open

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

/* ------------------------------ path matching ----------------------------- */
/**
 * "/"          exact match only — root is never treated as a prefix for all
 * "/legal/*"   the prefix itself and anything beneath it
 * "/about"     the path itself and anything beneath /about/
 * /^\/docs/    a RegExp is applied as-is
 */
export function pathMatches(pathname, patterns) {
  if (!Array.isArray(patterns) || patterns.length === 0) return false;
  return patterns.some((p) => {
    if (p instanceof RegExp) return p.test(pathname);
    if (typeof p !== "string" || p === "") return false;
    const clean = p.length > 1 ? p.replace(/\/+$/, "") : p;
    if (clean === "/") return pathname === "/" || pathname === "";
    if (clean.endsWith("/*")) {
      const base = clean.slice(0, -2);
      return pathname === base || pathname.startsWith(base + "/");
    }
    if (clean.endsWith("*")) return pathname.startsWith(clean.slice(0, -1));
    return pathname === clean || pathname.startsWith(clean + "/");
  });
}

/** Current pathname, kept in sync with SPA navigation as well as back/forward. */
function usePathname() {
  const [pathname, setPathname] = useState(() =>
    typeof window === "undefined" ? "/" : window.location.pathname
  );

  useEffect(() => {
    const update = () => setPathname(window.location.pathname);

    // Patch history once per page so client-side navigation notifies us too.
    if (!window.__mcHistoryPatched) {
      window.__mcHistoryPatched = true;
      ["pushState", "replaceState"].forEach((name) => {
        const original = window.history[name];
        window.history[name] = function patched(...args) {
          const result = original.apply(this, args);
          window.dispatchEvent(new Event("mc:navigation"));
          return result;
        };
      });
    }

    window.addEventListener("popstate", update);
    window.addEventListener("hashchange", update);
    window.addEventListener("mc:navigation", update);
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener("hashchange", update);
      window.removeEventListener("mc:navigation", update);
    };
  }, []);

  return pathname;
}

export default function MaintenanceGate({
  projectKey,
  children,
  fallbackTitle,
  publicPaths = [],
  protectedPaths = null,
}) {
  const [state, setState] = useState({ checked: false, row: null });
  const timer = useRef(null);
  const pathname = usePathname();

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

  // Is THIS route one the maintenance screen is allowed to cover?
  const gated = Array.isArray(protectedPaths)
    ? pathMatches(pathname, protectedPaths)
    : !pathMatches(pathname, publicPaths);

  // A public page never waits on the status check and is never covered.
  if (!gated) return children;

  // Before the first answer, show a neutral holding screen rather than
  // flashing the app we may be about to cover.
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

/* --------------------------------------------------------------------------
 * Presentation.
 *
 * Deliberately LIGHT ONLY — this page appears across many different apps, so
 * it holds one fixed, calm appearance rather than following the visitor's
 * system theme. It is fully static: no images, icons, webfonts or requests.
 *
 * Every rule is scoped under .mc-root, and every property the host app might
 * set (colour, font, margin, background) is declared explicitly. Without that
 * the surrounding app's global CSS bleeds in — which is exactly how a heading
 * ends up dark-on-dark and invisible.
 * -------------------------------------------------------------------------- */
const CSS = `
.mc-root, .mc-root *{box-sizing:border-box}
.mc-root h1,.mc-root p,.mc-root hr,.mc-root button{
  margin:0;padding:0;border:0;background:none;text-align:inherit;text-transform:none;
}
.mc-root{
  --mc-canvas:#f5f5f5; --mc-card:#ffffff; --mc-ink:#0c0a09; --mc-body:#4e4e4e;
  --mc-muted:#777169; --mc-line:#e7e5e4; --mc-primary:#292524; --mc-on-primary:#ffffff;
  color-scheme:light;
  position:fixed; inset:0; z-index:2147483000;
  display:grid; place-items:center; padding:24px; overflow:auto;
  background:var(--mc-canvas); color:var(--mc-body);
  font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  font-size:16px; font-weight:400; line-height:1.5; letter-spacing:.16px;
  -webkit-font-smoothing:antialiased;
}
.mc-root .mc-orb{
  position:absolute;border-radius:50%;filter:blur(58px);opacity:.55;pointer-events:none;z-index:0;
}
.mc-root .mc-card{
  position:relative; z-index:1; width:100%; max-width:520px; text-align:center;
  background:var(--mc-card); border:1px solid var(--mc-line);
  border-radius:24px; padding:56px 48px; box-shadow:0 4px 16px rgba(0,0,0,.04);
}
.mc-root .mc-eyebrow{
  font-size:12px; font-weight:600; line-height:1.4; letter-spacing:.96px;
  text-transform:uppercase; color:var(--mc-muted); margin:0 0 20px;
}
.mc-root .mc-h1{
  font-family:Newsreader,"Iowan Old Style",Palatino,"Palatino Linotype",Georgia,"Times New Roman",serif;
  font-weight:300; font-size:40px; line-height:1.1; letter-spacing:-.4px;
  color:var(--mc-ink); margin:0;
}
.mc-root .mc-rule{width:36px;height:1px;background:var(--mc-line);border:0;margin:28px auto}
.mc-root .mc-p{margin:0 auto;max-width:40ch;color:var(--mc-body);font-size:16px}
.mc-root .mc-eta{margin:20px 0 0;font-size:15px;letter-spacing:.15px;color:var(--mc-muted)}
.mc-root .mc-eta strong{color:var(--mc-ink);font-weight:500}
.mc-root .mc-btn{
  margin-top:32px; height:40px; padding:0 22px; border:0; border-radius:9999px;
  background:var(--mc-primary); color:var(--mc-on-primary);
  font-family:inherit; font-size:15px; font-weight:500; line-height:1;
  cursor:pointer; transition:background-color .18s ease;
}
.mc-root .mc-btn:hover{background:var(--mc-ink)}
.mc-root .mc-foot{margin:24px 0 0;font-size:13.5px;color:var(--mc-muted)}
.mc-root .mc-spin{
  width:24px;height:24px;border-radius:50%;
  border:2px solid var(--mc-line);border-top-color:var(--mc-ink);
  animation:mcspin .7s linear infinite;
}
@keyframes mcspin{to{transform:rotate(360deg)}}
@media (max-width:560px){
  .mc-root .mc-card{padding:44px 26px;border-radius:20px}
  .mc-root .mc-h1{font-size:32px;letter-spacing:-.32px}
}
@media (prefers-reduced-motion:reduce){.mc-root .mc-spin{animation-duration:.01ms}}
`;

function Style() {
  return <style dangerouslySetInnerHTML={{ __html: CSS }} />;
}

/* Soft pastel atmosphere. Decoration only — it never carries meaning. */
function Orbs() {
  const orbs = [
    { c: "#a8c8e8", s: 360, top: "-130px", left: "-120px" },
    { c: "#e8b8c4", s: 320, top: "58%", left: "70%" },
    { c: "#a7e5d3", s: 280, top: "74%", left: "-80px" },
  ];
  return orbs.map((o, i) => (
    <span
      key={i}
      className="mc-orb"
      style={{ background: o.c, width: o.s, height: o.s, top: o.top, left: o.left }}
    />
  ));
}

/* Neutral holding screen, shown only while the first check is in flight. */
function Splash() {
  return (
    <div className="mc-root">
      <Style />
      <div className="mc-spin" />
    </div>
  );
}

export function MaintenanceScreen({ title, message, eta }) {
  const etaText = eta
    ? new Date(eta).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : null;

  return (
    <div className="mc-root">
      <Style />
      <Orbs />
      <div className="mc-card">
        <p className="mc-eyebrow">{title}</p>
        <h1 className="mc-h1">We&rsquo;ll be right back</h1>
        <hr className="mc-rule" />
        <p className="mc-p">
          {message ||
            "This service is briefly unavailable while we carry out maintenance. Your data is safe and nothing has been lost."}
        </p>
        {etaText && (
          <p className="mc-eta">
            Expected back around <strong>{etaText}</strong>
          </p>
        )}
        <button className="mc-btn" type="button" onClick={() => window.location.reload()}>
          Try again
        </button>
        <p className="mc-foot">This page updates automatically once the service is restored.</p>
      </div>
    </div>
  );
}
