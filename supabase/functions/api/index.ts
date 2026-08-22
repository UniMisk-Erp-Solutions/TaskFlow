import { createClient } from "npm:@supabase/supabase-js@2";

// ─────────────────────────────────────────────────────────────────────────────
// Inlined push module. Nothing here loads Node-only npm modules at module
// evaluation time; `web-push` is imported lazily inside `getWebPush()`.
// This keeps the function bootable on every Supabase Edge runtime — auth and
// CRUD routes never touch the push code path on boot.
// ─────────────────────────────────────────────────────────────────────────────
type PushCategory = "task_assigned" | "meeting_assigned" | "task_update" | "meeting_update";

type WebPushLib = {
  setVapidDetails: (subject: string, pub: string, priv: string) => void;
  sendNotification: (
    sub: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload: string,
    options?: Record<string, unknown>,
  ) => Promise<unknown>;
};

const DEFAULT_PREFS = {
  push_enabled: false,
  notify_task_assigned: true,
  notify_meeting_assigned: true,
  notify_task_updates: true,
  notify_meeting_updates: true,
};

let webpushPromise: Promise<WebPushLib | null> | null = null;
async function getWebPush(): Promise<WebPushLib | null> {
  if (!webpushPromise) {
    webpushPromise = (async (): Promise<WebPushLib | null> => {
      try {
        const mod = await import("npm:web-push@3.6.7");
        const lib = (mod.default ?? mod) as WebPushLib;
        if (!lib?.setVapidDetails || !lib?.sendNotification) return null;
        return lib;
      } catch (err) {
        console.warn("[push] web-push failed to load on edge:", (err as Error)?.message);
        return null;
      }
    })();
  }
  return webpushPromise;
}

let vapidReady = false;
async function ensurePushLib(): Promise<WebPushLib | null> {
  const pub = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
  const priv = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
  if (!pub || !priv) return null;
  const lib = await getWebPush();
  if (!lib) return null;
  if (!vapidReady) {
    try {
      lib.setVapidDetails(Deno.env.get("VAPID_SUBJECT") ?? "mailto:noreply@localhost", pub, priv);
      vapidReady = true;
    } catch (err) {
      console.warn("[push] setVapidDetails failed:", (err as Error)?.message);
      return null;
    }
  }
  return lib;
}

function pushAllows(prefs: Record<string, unknown> | null, category: PushCategory): boolean {
  if (!prefs || !prefs.push_enabled) return false;
  if (category === "task_assigned") return !!prefs.notify_task_assigned;
  if (category === "meeting_assigned") return !!prefs.notify_meeting_assigned;
  if (category === "task_update") return !!prefs.notify_task_updates;
  if (category === "meeting_update") return !!prefs.notify_meeting_updates;
  return false;
}

async function getOrCreatePushPrefs(userId: string) {
  try {
    const { data: row } = await supabase.from("notification_preferences").select("*").eq("user_id", userId)
      .maybeSingle();
    if (row) return row;
    const { data: inserted, error } = await supabase.from("notification_preferences").insert([{
      user_id: userId,
      ...DEFAULT_PREFS,
    }]).select().single();
    if (error) throw error;
    return inserted;
  } catch (err) {
    console.warn("[push] preferences read failed (table may not exist yet):", (err as Error)?.message);
    return null;
  }
}

async function fetchSubsForUser(userId: string) {
  try {
    const { data, error } = await supabase.from("push_subscriptions").select("*").eq("user_id", userId);
    if (error) throw error;
    return data ?? [];
  } catch (err) {
    console.warn("[push] subscriptions read failed (table may not exist yet):", (err as Error)?.message);
    return [];
  }
}

async function getActorDisplayName(_supabaseUnused: unknown, actorId: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("full_name, email").eq("id", actorId).maybeSingle();
  if (!data) return "Someone";
  const name = String(data.full_name || "").trim();
  return name || String(data.email || "") || "Someone";
}

async function notifyUsers(opts: {
  userIds: string[];
  excludeUserId?: string;
  category: PushCategory;
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<void> {
  const lib = await ensurePushLib();
  if (!lib) return;
  const { userIds, excludeUserId, category, title, body, data } = opts;
  const unique = [...new Set((userIds || []).filter(Boolean))].filter((id) => id !== excludeUserId);
  if (!unique.length) return;

  const payload = JSON.stringify({
    title: String(title || "TaskFlow"),
    body: String(body || ""),
    data: { url: "/", ...(data || {}) },
  });

  for (const uid of unique) {
    const prefs = await getOrCreatePushPrefs(uid);
    if (!pushAllows(prefs, category)) continue;
    const subs = await fetchSubsForUser(uid) as { id: string; endpoint: string; p256dh: string; auth: string }[];
    for (const sub of subs) {
      try {
        await lib.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, {
          TTL: 86_400,
          urgency: "normal",
        });
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }
  }
}

function scheduleNotify(fn: () => Promise<void>): void {
  queueMicrotask(() => {
    fn().catch((e) => console.error("[push]", e));
  });
}

// Run a promise to completion in the background and return control to the caller now.
// Uses the Supabase edge runtime's waitUntil (keeps the isolate alive until the promise
// settles) when available — important because WhatsApp send-text can take 10-30s on this
// overloaded box; otherwise falls back to a microtask.
function runBackground(p: Promise<unknown>): void {
  const done = Promise.resolve(p).catch((e) => console.error("[whatsapp] bg:", (e as Error)?.message));
  try {
    // @ts-ignore EdgeRuntime is injected by the Supabase edge runtime
    if (typeof EdgeRuntime !== "undefined" && typeof EdgeRuntime.waitUntil === "function") {
      console.log("[wa] bg via waitUntil");
      // @ts-ignore
      EdgeRuntime.waitUntil(done);
      return;
    }
  } catch { /* fall through */ }
  console.log("[wa] bg via microtask (no waitUntil)");
  queueMicrotask(() => { void done; });
}

// Alias so existing call sites that pass `supabase` keep working.
function notifyUsersEdge(_supabaseUnused: unknown, opts: Parameters<typeof notifyUsers>[0]) {
  return notifyUsers(opts);
}

async function jsonPush(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleNotificationRoutes(
  req: Request,
  path: string,
  _supabaseUnused: unknown,
  requireAuthFn: typeof requireAuth,
): Promise<Response | null> {
  if (!path.startsWith("/notifications/")) return null;

  if (req.method === "GET" && path === "/notifications/vapid-public-key") {
    const pub = Deno.env.get("VAPID_PUBLIC_KEY");
    if (!pub) return jsonPush({ error: "Push notifications are not configured (missing VAPID keys)." }, 503);
    return jsonPush({ publicKey: pub });
  }

  const authResult = await requireAuthFn(req);
  if ("error" in authResult) return authResult.error;
  const userId = authResult.user.id;

  if (req.method === "GET" && path === "/notifications/preferences") {
    const prefs = await getOrCreatePushPrefs(userId);
    return jsonPush(prefs ?? { ...DEFAULT_PREFS, user_id: userId });
  }

  if (req.method === "PATCH" && path === "/notifications/preferences") {
    const body = (await parseBody(req)) as Record<string, unknown>;
    const allowed = [
      "push_enabled",
      "notify_task_assigned",
      "notify_meeting_assigned",
      "notify_task_updates",
      "notify_meeting_updates",
    ] as const;
    const next: Record<string, boolean | string> = { updated_at: new Date().toISOString() };
    let hasAny = false;
    for (const k of allowed) {
      if (Object.prototype.hasOwnProperty.call(body, k)) {
        next[k] = !!body[k];
        hasAny = true;
      }
    }
    await getOrCreatePushPrefs(userId);
    if (!hasAny) {
      const prefs = await getOrCreatePushPrefs(userId);
      return jsonPush(prefs);
    }
    const { data, error } = await supabase.from("notification_preferences").update(next).eq("user_id", userId).select()
      .single();
    if (error) return jsonPush({ error: error.message }, 400);
    return jsonPush(data);
  }

  if (req.method === "POST" && path === "/notifications/subscribe") {
    const lib = await ensurePushLib();
    if (!lib) return jsonPush({ error: "Push notifications are not configured." }, 503);
    const sub = (await parseBody(req)) as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
      return jsonPush({ error: "Invalid push subscription" }, 400);
    }
    await supabase.from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", sub.endpoint);
    const { error } = await supabase.from("push_subscriptions").insert([{
      user_id: userId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      user_agent: req.headers.get("user-agent") || null,
    }]);
    if (error) return jsonPush({ error: error.message }, 400);
    await getOrCreatePushPrefs(userId);
    const { data } = await supabase
      .from("notification_preferences")
      .update({ push_enabled: true, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .select()
      .single();
    return jsonPush({ ok: true, preferences: data }, 201);
  }

  if (req.method === "POST" && path === "/notifications/unsubscribe") {
    const body = (await parseBody(req)) as { endpoint?: string };
    if (body.endpoint) {
      await supabase.from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", body.endpoint);
    } else {
      await supabase.from("push_subscriptions").delete().eq("user_id", userId);
    }
    const { count } = await supabase
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    let prefsRow;
    if (!count || count === 0) {
      await getOrCreatePushPrefs(userId);
      const { data } = await supabase
        .from("notification_preferences")
        .update({ push_enabled: false, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .select()
        .single();
      prefsRow = data;
    } else {
      prefsRow = await getOrCreatePushPrefs(userId);
    }
    return jsonPush({ ok: true, preferences: prefsRow });
  }

  return null;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

if (!SUPABASE_URL) console.error("[edge api] SUPABASE_URL is not set");
if (!SERVICE_ROLE_KEY) {
  console.error(
    "[edge api] SUPABASE_SERVICE_ROLE_KEY is not set; queries will run as anon and trigger RLS (possibly causing 'infinite recursion' on cross-table policies).",
  );
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/**
 * supabase-js v2 mutates a client's internal auth state whenever you call
 * `auth.signInWithPassword` on it — even with `persistSession: false`. After
 * that, the same client sends the *user's* access_token as the Authorization
 * header instead of the service-role JWT, so PostgREST silently downgrades
 * us to the `authenticated` role and RLS kicks in. That used to surface as
 * "new row violates row-level security policy for table task_assignees" when
 * an admin tried to assign a task right after signing in/up.
 *
 * Keep the global `supabase` client pinned to service_role and use a throwaway
 * client for password sign-in instead.
 */
function createAuthClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, storageKey: `auth-${crypto.randomUUID()}` },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// OpenWA (self-hosted WhatsApp) — auto-notify the ASSIGNEE(S) on task/meeting
// creation. One message per assigned user who has a phone number, sent once at
// create time, ONLY to that user's number (never a broadcast). No inbound
// webhook/auto-reply is configured, so nobody messaging the bot gets a reply.
// ─────────────────────────────────────────────────────────────────────────────
const OPENWA_API_URL = (Deno.env.get("OPENWA_API_URL") || "https://whatsapp-api.unimisk.com").replace(/\/+$/, "");
const OPENWA_SESSION_NAME = Deno.env.get("OPENWA_SESSION_NAME") || "taskflow-assistant";
const OPENWA_SESSION_ID_DEFAULT = Deno.env.get("OPENWA_SESSION_ID") || "12ace9c9-c0c8-4cf9-a1ed-c4f6fbaf55f3";
const OPENWA_DEFAULT_CC = Deno.env.get("OPENWA_DEFAULT_CC") || "91"; // default country code (India)

// API key comes from env OR the public.app_settings table (key 'openwa_api_key'),
// so it can be set/rotated purely via SQL — no redeploy needed. Cached ~60s.
const _settingsCache: { at: number; map: Record<string, string> } = { at: 0, map: {} };
async function getAppSetting(key: string): Promise<string> {
  const now = Date.now();
  if (now - _settingsCache.at > 60_000) {
    try {
      const { data } = await supabase.from("app_settings").select("key, value");
      const m: Record<string, string> = {};
      for (const r of (data || []) as any[]) m[r.key] = r.value ?? "";
      _settingsCache.map = m;
      _settingsCache.at = now;
    } catch { /* table may not exist yet / transient — keep previous cache */ }
  }
  return _settingsCache.map[key] ?? "";
}
async function openwaApiKey(): Promise<string> {
  return Deno.env.get("OPENWA_API_KEY") || (await getAppSetting("openwa_api_key"));
}

let _openwaSessionId: string | null = null;
async function openwaSessionId(): Promise<string | null> {
  if (_openwaSessionId) return _openwaSessionId;
  // Resolve by session NAME so a re-created "taskflow-assistant" still works; fall back to the configured id.
  try {
    const r = await fetch(`${OPENWA_API_URL}/api/sessions`, { headers: { "X-API-Key": await openwaApiKey() } });
    if (r.ok) {
      const list = await r.json();
      const found = (Array.isArray(list) ? list : []).find((s: any) => s?.name === OPENWA_SESSION_NAME);
      _openwaSessionId = found?.id || OPENWA_SESSION_ID_DEFAULT || null;
      return _openwaSessionId;
    }
  } catch { /* ignore — fall through to default */ }
  _openwaSessionId = OPENWA_SESSION_ID_DEFAULT || null;
  return _openwaSessionId;
}

// "+91 98765-43210" / "9876543210" / "919876543210" -> "919876543210@c.us"
function openwaChatId(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let d = String(phone).replace(/\D+/g, "");
  if (!d) return null;
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);   // drop leading trunk zero
  if (d.length === 10) d = OPENWA_DEFAULT_CC + d;             // bare local number -> prepend country code
  if (d.length < 11) return null;                             // implausibly short, skip
  return `${d}@c.us`;
}

// Fetch with a hard timeout. On this overloaded box OpenWA accepts + DELIVERS the message
// but is often slow to RETURN the HTTP response; aborting the wait is fine (the small POST
// has already flushed to OpenWA — proven by manual sends delivering after a client abort).
// We only cap how long we block. Returns null on timeout/error.
async function fetchTimeout(url: string, init: RequestInit, ms: number): Promise<Response | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...init, signal: ctrl.signal }); }
  catch { return null; }
  finally { clearTimeout(t); }
}

async function openwaSendText(chatId: string, text: string): Promise<void> {
  const apiKey = await openwaApiKey();
  if (!apiKey) return;
  const sessionId = await openwaSessionId();
  if (!sessionId) return;
  const r = await fetchTimeout(`${OPENWA_API_URL}/api/sessions/${sessionId}/messages/send-text`, {
    method: "POST",
    headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ chatId, text: String(text).slice(0, 4096) }),
  }, 8000);
  if (r && !r.ok) console.warn(`[whatsapp] send to ${chatId} -> HTTP ${r.status}`);
}

function capWord(s: string) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function buildTaskWhatsApp(t: any, assigner: string, name?: string): string {
  const L: string[] = ["📋 *New Task Assigned*", ""];
  if (name) L.push(`Hi ${name},`, "");
  L.push(`*Title:* ${t.title || "Untitled"}`);
  L.push(`*Priority:* ${capWord(String(t.priority || "medium"))}`);
  if (t.due_date) L.push(`*Due:* ${t.due_date}${t.due_time ? " at " + String(t.due_time).slice(0, 5) : ""}`);
  if (t.project_name) L.push(`*Project:* ${t.project_name}`);
  if (t.description && String(t.description).trim()) L.push(`*Description:* ${String(t.description).trim()}`);
  L.push("", `Assigned by ${assigner} · TaskFlow`);
  return L.join("\n");
}

function buildMeetingWhatsApp(m: any, assigner: string, name?: string): string {
  const L: string[] = ["📅 *New Meeting Assigned*", ""];
  if (name) L.push(`Hi ${name},`, "");
  L.push(`*Title:* ${m.title || "Untitled"}`);
  L.push(`*Priority:* ${capWord(String(m.priority || "medium"))}`);
  if (m.meeting_date) L.push(`*When:* ${m.meeting_date}${m.meeting_time ? " at " + String(m.meeting_time).slice(0, 5) : ""}`);
  if (m.project_name) L.push(`*Project:* ${m.project_name}`);
  if (m.description && String(m.description).trim()) L.push(`*Description:* ${String(m.description).trim()}`);
  L.push("", `Assigned by ${assigner} · TaskFlow`);
  return L.join("\n");
}

// Notify each assigned user who has a phone (excluding the creator). One message each, targeted.
async function whatsappNotifyAssignees(
  kind: "task" | "meeting",
  row: any,
  assignerName: string,
  excludeUserId: string,
): Promise<void> {
  if (!(await openwaApiKey())) return; // WhatsApp notify not configured
  const ids: string[] = (row.assignee_ids || []).filter((id: string) => id && id !== excludeUserId);
  if (!ids.length) return;
  const { data: profs } = await supabase.from("profiles").select("id, full_name, phone").in("id", ids);
  const targets = (profs || []).filter((p: any) => p.phone && String(p.phone).trim());
  for (const p of targets) {
    const chatId = openwaChatId(p.phone);
    if (!chatId) continue;
    const text = kind === "task"
      ? buildTaskWhatsApp(row, assignerName, p.full_name)
      : buildMeetingWhatsApp(row, assignerName, p.full_name);
    await openwaSendText(chatId, text);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Inbound WhatsApp bot: a KNOWN user (number saved on their TaskFlow profile)
// DMs "/taskflow" and is walked through a chat form to create a task/meeting
// that lands in the app. Numbers not mapping to a profile are IGNORED (no reply);
// the bot only ever talks to the sender it's in a flow with. WhatsApp personal
// accounts can't render button/list forms, so the "form" is a guided Q&A.
// ─────────────────────────────────────────────────────────────────────────────
async function waWebhookSecret(): Promise<string> {
  return Deno.env.get("WA_WEBHOOK_SECRET") || (await getAppSetting("wa_webhook_secret"));
}

function waDigits(jid: string | null | undefined): string {
  if (!jid) return "";
  return String(jid).split("@")[0].split(":")[0].replace(/\D+/g, "");
}

// WhatsApp now addresses senders with privacy "@lid" IDs (e.g. "271382004895763@lid")
// that are NOT phone numbers. Resolve them to the real "@c.us" number via OpenWA's
// contact lookup so we can map the sender to a TaskFlow profile. "@c.us" jids pass through.
const _waPhoneCache = new Map<string, { phone: string; at: number }>();
async function waResolveSenderPhone(jid: string | null | undefined): Promise<string> {
  const raw = String(jid ?? "").trim();
  if (!raw) return "";
  if (raw.includes("@c.us") || !raw.includes("@")) return waDigits(raw); // already a phone
  const cached = _waPhoneCache.get(raw);
  if (cached && (Date.now() - cached.at) < 3_600_000) return cached.phone;
  try {
    const apiKey = await openwaApiKey();
    const sessionId = await openwaSessionId();
    if (apiKey && sessionId) {
      const r = await fetchTimeout(`${OPENWA_API_URL}/api/sessions/${sessionId}/contacts/${raw}`, {
        headers: { "X-API-Key": apiKey },
      }, 8000);
      if (r && r.ok) {
        const c = await r.json();
        const id = String(c?.id ?? "");                 // e.g. "918160500203@c.us"
        if (id.includes("@c.us")) {
          const phone = waDigits(id);
          _waPhoneCache.set(raw, { phone, at: Date.now() });
          return phone;
        }
      }
    }
  } catch { /* fall through to raw digits (won't match a profile) */ }
  return waDigits(raw);
}

async function waFindProfileByPhone(digits: string): Promise<any | null> {
  if (!digits || digits.length < 10) return null;
  const last10 = digits.slice(-10);
  const { data } = await supabase.from("profiles").select("id, full_name, email, org_id, phone, role").not("phone", "is", null);
  for (const p of (data || []) as any[]) {
    const pd = String(p.phone || "").replace(/\D+/g, "");
    if (pd.length >= 10 && pd.slice(-10) === last10) return p;
  }
  return null;
}

async function waCreateItem(draft: any, creator: any, assigneeId: string): Promise<{ error?: string; id?: string }> {
  const isMeeting = draft.kind === "meeting";
  const base: any = {
    title: draft.title, description: draft.description || null, assignee_id: assigneeId,
    priority: draft.priority || "medium", created_by: creator.id, org_id: creator.org_id,
    project_id: draft.project_id || null,
  };
  if (isMeeting) { base.status = "scheduled"; base.meeting_date = draft.date || null; }
  else { base.status = "pending"; base.due_date = draft.date || null; }
  const table = isMeeting ? "meetings" : "tasks";
  const jn = isMeeting ? "meeting_assignees" : "task_assignees";
  const fk = isMeeting ? "meeting_id" : "task_id";
  const { data: row, error } = await supabase.from(table).insert([base]).select("id").single();
  if (error) return { error: error.message };
  if (row?.id) { try { await supabase.from(jn).insert([{ [fk]: row.id, profile_id: assigneeId }]); } catch { /* */ } }
  try {
    const shaped = { assignee_ids: [assigneeId], title: draft.title, description: draft.description || "", priority: draft.priority || "medium", due_date: draft.date || null, due_time: null, meeting_date: draft.date || null, meeting_time: null, project_name: draft.project_name || null };
    await whatsappNotifyAssignees(isMeeting ? "meeting" : "task", shaped, creator.full_name || "A colleague", creator.id);
  } catch { /* notify is best-effort */ }
  return { id: row?.id };
}

// ── WhatsApp bot helpers: users type & read dates as DD-MM-YYYY; the DB stores YYYY-MM-DD ──
function waParseDate(s: string): string | null {           // "20-07-2026" -> "2026-07-20"
  const m = String(s).match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (!m) return null;
  const dd = m[1].padStart(2, "0"), mm = m[2].padStart(2, "0"), yy = m[3];
  if (+mm < 1 || +mm > 12 || +dd < 1 || +dd > 31) return null;
  return `${yy}-${mm}-${dd}`;
}
function waFmtDate(iso: string | null | undefined): string { // "2026-07-20" -> "20-07-2026"
  if (!iso) return "—";
  const m = String(iso).match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : String(iso);
}
// Review summary shown before creation (Confirm/Cancel step).
function waSummary(draft: any): string {
  const isMeeting = draft.kind === "meeting";
  return [
    `📋 Please review your ${isMeeting ? "*Meeting*" : "*Task*"}:`, "",
    `• *Title:* ${draft.title || "—"}`,
    `• *Description:* ${draft.description ? draft.description : "—"}`,
    `• *Project:* ${draft.project_name || "None"}`,
    `• *Priority:* ${capWord(draft.priority || "medium")}`,
    `• *${isMeeting ? "Date" : "Due"}:* ${waFmtDate(draft.date)}`,
    `• *Assign to:* ${draft.assignee_name || "—"}`,
    "",
    "✅ Reply *confirm* to create",
    "❌ Reply *cancel* to discard",
  ].join("\n");
}
// "View Calendar": the user's own tasks & meetings (assigned to or created by them), by date.
async function waBuildCalendar(profile: any): Promise<string> {
  const uid = profile.id;
  const { data: tasks } = await supabase.from("tasks").select("title, due_date, status")
    .or(`assignee_id.eq.${uid},created_by.eq.${uid}`).order("due_date", { ascending: true, nullsFirst: false }).limit(15);
  const { data: meets } = await supabase.from("meetings").select("title, meeting_date, status")
    .or(`assignee_id.eq.${uid},created_by.eq.${uid}`).order("meeting_date", { ascending: true, nullsFirst: false }).limit(15);
  const L: string[] = ["🗓️ *Your Calendar*", "", "*📋 Tasks*"];
  if (tasks && (tasks as any[]).length) for (const t of tasks as any[]) L.push(`• ${t.title} — ${waFmtDate(t.due_date)}${t.status ? ` _(${t.status})_` : ""}`);
  else L.push("_none_");
  L.push("", "*📅 Meetings*");
  if (meets && (meets as any[]).length) for (const m of meets as any[]) L.push(`• ${m.title} — ${waFmtDate(m.meeting_date)}${m.status ? ` _(${m.status})_` : ""}`);
  else L.push("_none_");
  L.push("", "Send */taskflow* to create a new one.");
  return L.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// 24-hour "due soon" WhatsApp reminders. Triggered hourly by host cron:
//   POST /cron/reminders   (header X-Cron-Secret: app_settings 'cron_secret')
// An item is announced once, the first hour it falls inside the next 24h — so a
// missed cron run still reminds (late) rather than skipping. public.reminders_sent
// is the dedupe ledger. Read-only w.r.t. tasks/meetings: nothing else is touched.
// ─────────────────────────────────────────────────────────────────────────────
const IST_MS = 5.5 * 3600 * 1000;
async function cronSecret(): Promise<string> {
  return Deno.env.get("CRON_SECRET") || (await getAppSetting("cron_secret"));
}
/** Combine a DATE + optional TIME (stored without a zone, meant as IST) into a real instant. */
function dueAtFromIst(dateStr: string, timeStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const t = String(timeStr || "09:00:00").slice(0, 8);            // date-only items -> 09:00 IST
  const asIfUtc = new Date(`${dateStr}T${t.length === 5 ? t + ":00" : t}Z`);
  if (isNaN(asIfUtc.getTime())) return null;
  return new Date(asIfUtc.getTime() - IST_MS);                     // that wall-clock was IST
}
function fmtIstTime(timeStr: string | null | undefined): string {
  return timeStr ? ` at ${String(timeStr).slice(0, 5)}` : "";
}
/** WhatsApp every assignee of the item who has a phone. Returns how many were messaged. */
async function remindAssignees(kind: "task" | "meeting", row: any, dueAt: Date): Promise<number> {
  const ids = new Set<string>();
  if (row.assignee_id) ids.add(row.assignee_id);
  const jn = kind === "task" ? "task_assignees" : "meeting_assignees";
  const fk = kind === "task" ? "task_id" : "meeting_id";
  const { data: links } = await supabase.from(jn).select("profile_id").eq(fk, row.id);
  for (const l of (links || []) as any[]) if (l.profile_id) ids.add(l.profile_id);
  if (!ids.size) return 0;

  const { data: profs } = await supabase.from("profiles").select("id, full_name, phone").in("id", [...ids]);
  const targets = (profs || []).filter((p: any) => p.phone && String(p.phone).trim());
  if (!targets.length) return 0;

  let projectName: string | null = null;
  if (row.project_id) {
    const { data: pr } = await supabase.from("projects").select("name").eq("id", row.project_id).maybeSingle();
    projectName = (pr as any)?.name ?? null;
  }
  const dateStr = kind === "task" ? row.due_date : row.meeting_date;
  const timeStr = kind === "task" ? row.due_time : row.meeting_time;

  let sent = 0;
  for (const p of targets as any[]) {
    const chat = openwaChatId(p.phone);
    if (!chat) continue;
    const L = [
      kind === "task" ? "⏰ *Reminder — task due in 24 hours*" : "⏰ *Reminder — meeting in 24 hours*", "",
      `Hi ${p.full_name || "there"},`, "",
      `*${row.title || "Untitled"}*`,
      `📅 ${kind === "task" ? "Due" : "When"}: ${waFmtDate(dateStr)}${fmtIstTime(timeStr)}`,
    ];
    if (row.priority) L.push(`🚦 Priority: ${capWord(String(row.priority))}`);
    if (projectName) L.push(`📁 Project: ${projectName}`);
    L.push("", "— TaskFlow");
    await openwaSendText(chat, L.join("\n"));
    sent++;
  }
  return sent;
}

async function handleCronReminders(req: Request): Promise<Response> {
  const secret = await cronSecret();
  if (secret && (req.headers.get("x-cron-secret") || "") !== secret) return new Response("forbidden", { status: 403 });

  const now = new Date();
  const horizon = new Date(now.getTime() + 24 * 3600 * 1000);
  // Widen the date filter by a day either side so IST/UTC edges can't clip anything.
  const from = new Date(now.getTime() + IST_MS - 24 * 3600 * 1000).toISOString().slice(0, 10);
  const to = new Date(now.getTime() + IST_MS + 48 * 3600 * 1000).toISOString().slice(0, 10);

  const [tasksRes, meetsRes] = await Promise.all([
    supabase.from("tasks").select("id, title, due_date, due_time, status, priority, assignee_id, project_id")
      .not("due_date", "is", null).gte("due_date", from).lte("due_date", to).neq("status", "completed").limit(200),
    supabase.from("meetings").select("id, title, meeting_date, meeting_time, status, priority, assignee_id, project_id")
      .not("meeting_date", "is", null).gte("meeting_date", from).lte("meeting_date", to)
      .neq("status", "completed").neq("status", "cancelled").limit(200),
  ]);

  const due: Array<{ kind: "task" | "meeting"; row: any; dueAt: Date }> = [];
  for (const r of (tasksRes.data || []) as any[]) {
    const d = dueAtFromIst(r.due_date, r.due_time);
    if (d && d > now && d <= horizon) due.push({ kind: "task", row: r, dueAt: d });
  }
  for (const r of (meetsRes.data || []) as any[]) {
    const d = dueAtFromIst(r.meeting_date, r.meeting_time);
    if (d && d > now && d <= horizon) due.push({ kind: "meeting", row: r, dueAt: d });
  }
  due.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());

  let reminded = 0, messages = 0, skipped = 0;
  for (const item of due.slice(0, 25)) {           // bounded per run; cron repeats hourly
    // Claim first: on a duplicate key this item was already announced for this due_at.
    const { error: claimErr } = await supabase.from("reminders_sent")
      .insert({ kind: item.kind, item_id: item.row.id, due_at: item.dueAt.toISOString(), recipients: 0 });
    if (claimErr) {
      if ((claimErr as any).code === "23505") { skipped++; continue; }
      console.warn("[cron] claim failed:", (claimErr as any).message);
      continue;
    }
    const n = await remindAssignees(item.kind, item.row, item.dueAt);
    messages += n; reminded++;
    await supabase.from("reminders_sent").update({ recipients: n })
      .eq("kind", item.kind).eq("item_id", item.row.id).eq("due_at", item.dueAt.toISOString());
    console.log(`[cron] reminded ${item.kind} "${item.row.title}" -> ${n} recipient(s)`);
  }
  return json({ ok: true, in_window: due.length, reminded, messages, already_sent: skipped });
}

// ─────────────────────────────────────────────────────────────────────────────
// Axynt AI integration (two-way, one shared HMAC secret).
//   Inbound  Axynt -> TaskFlow:  POST /ai-callback   (agent calls TaskFlow tools)
//   Outbound TaskFlow -> Axynt:  postToAxynt() / POST /ai/axynt   (send a message)
//   Signature: X-Signature: sha256=<hex HMAC-SHA256 of the RAW body>.
//   Secret + inbound URL come from app_settings ('axynt_webhook_secret',
//   'axynt_inbound_url') or env. Inbound FAILS CLOSED (no secret -> 503).
//   Param keys == Postgres columns (snake_case); id/created_at/updated_at are
//   never accepted (server-generated). Every operation is scoped to one org_id.
// ─────────────────────────────────────────────────────────────────────────────
async function axyntSecret(): Promise<string> {
  return Deno.env.get("AXYNT_WEBHOOK_SECRET") || (await getAppSetting("axynt_webhook_secret"));
}
async function axyntInboundUrl(): Promise<string> {
  return Deno.env.get("AXYNT_INBOUND_URL") || (await getAppSetting("axynt_inbound_url"));
}
async function axyntHmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function axyntSafeEqual(a: string, b: string): boolean { // constant-time, equal-length hex
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const AXYNT_PRIORITIES = ["low", "medium", "high"];
const AXYNT_TASK_STATUS = ["pending", "in_progress", "completed", "blocked"];
const AXYNT_MEET_STATUS = ["scheduled", "completed", "cancelled"];
function axErr(message: string, status = 400) { return { __error: message, __status: status }; }
function axIsErr(x: any): x is { __error: string; __status: number } { return x && typeof x.__error === "string"; }

async function axResolveOrg(params: any): Promise<string | { __error: string; __status: number }> {
  const orgId = params?.org_id ? String(params.org_id) : "";
  const orgUid = params?.org_uid ? String(params.org_uid).replace(/\D+/g, "") : "";
  if (orgId) { const { data } = await supabase.from("organizations").select("id").eq("id", orgId).maybeSingle(); return data ? orgId : axErr("org_id not found", 404); }
  if (orgUid) { const { data } = await supabase.from("organizations").select("id").eq("org_uid", orgUid).maybeSingle(); return data ? data.id : axErr("org_uid not found", 404); }
  return axErr("org_id (or org_uid) is required", 400);
}
async function axBelongsToOrg(table: string, id: string, orgId: string): Promise<boolean> {
  const { data } = await supabase.from(table).select("id").eq("id", id).eq("org_id", orgId).maybeSingle();
  return !!data;
}

async function axCreateItem(kind: "task" | "meeting", params: any) {
  const org = await axResolveOrg(params); if (axIsErr(org)) return org;
  const title = String(params.title ?? "").trim();
  if (!title) return axErr("title is required");
  const priority = params.priority ? String(params.priority).toLowerCase() : "medium";
  if (!AXYNT_PRIORITIES.includes(priority)) return axErr(`priority must be one of ${AXYNT_PRIORITIES.join(", ")}`);
  if (params.project_id && !(await axBelongsToOrg("projects", String(params.project_id), org)))
    return axErr("project_id not found in this organization", 404);
  let assigneeId: string | null = null;
  if (params.assignee_id) {
    const { data } = await supabase.from("profiles").select("id").eq("id", String(params.assignee_id)).eq("org_id", org).maybeSingle();
    if (!data) return axErr("assignee_id not found in this organization", 404);
    assigneeId = String(params.assignee_id);
  }
  const isM = kind === "meeting";
  const row: any = {
    title, description: params.description ?? null, assignee_id: assigneeId,
    project_id: params.project_id ?? null, priority, org_id: org, created_by: null,
    status: isM ? "scheduled" : "pending",
  };
  if (isM) { row.meeting_date = params.meeting_date ?? null; row.meeting_time = params.meeting_time ?? null; }
  else { row.due_date = params.due_date ?? null; row.due_time = params.due_time ?? null; }
  const table = isM ? "meetings" : "tasks";
  const { data: created, error } = await supabase.from(table).insert([row]).select("*").single();
  if (error) return axErr(error.message);
  if (assigneeId) {
    const jn = isM ? "meeting_assignees" : "task_assignees";
    const fk = isM ? "meeting_id" : "task_id";
    await supabase.from(jn).insert([{ [fk]: created.id, profile_id: assigneeId }]);
  }
  return created;
}
async function axUpdateItem(kind: "task" | "meeting", params: any) {
  const isM = kind === "meeting";
  const idKey = isM ? "meeting_id" : "task_id";
  const id = String(params[idKey] ?? "");
  if (!id) return axErr(`${idKey} is required`);
  const table = isM ? "meetings" : "tasks";
  const { data: existing } = await supabase.from(table).select("id, org_id").eq("id", id).maybeSingle();
  if (!existing) return axErr(`${idKey} not found`, 404);
  const STATUSES = isM ? AXYNT_MEET_STATUS : AXYNT_TASK_STATUS;
  const patch: any = {};
  if (params.title !== undefined) { const t = String(params.title).trim(); if (!t) return axErr("title cannot be empty"); patch.title = t; }
  if (params.description !== undefined) patch.description = params.description;
  if (params.priority !== undefined) { const p = String(params.priority).toLowerCase(); if (!AXYNT_PRIORITIES.includes(p)) return axErr(`priority must be one of ${AXYNT_PRIORITIES.join(", ")}`); patch.priority = p; }
  if (params.status !== undefined) { const s = String(params.status); if (!STATUSES.includes(s)) return axErr(`status must be one of ${STATUSES.join(", ")}`); patch.status = s; }
  if (isM) {
    if (params.meeting_date !== undefined) patch.meeting_date = params.meeting_date || null;
    if (params.meeting_time !== undefined) patch.meeting_time = params.meeting_time || null;
  } else {
    if (params.due_date !== undefined) patch.due_date = params.due_date || null;
    if (params.due_time !== undefined) patch.due_time = params.due_time || null;
  }
  if (params.project_id !== undefined) {
    if (params.project_id && !(await axBelongsToOrg("projects", String(params.project_id), existing.org_id))) return axErr("project_id not found in this organization", 404);
    patch.project_id = params.project_id || null;
  }
  let assigneeChange = false, assigneeId: string | null = null;
  if (params.assignee_id !== undefined) {
    if (params.assignee_id) {
      const { data } = await supabase.from("profiles").select("id").eq("id", String(params.assignee_id)).eq("org_id", existing.org_id).maybeSingle();
      if (!data) return axErr("assignee_id not found in this organization", 404);
      assigneeId = String(params.assignee_id);
    }
    patch.assignee_id = params.assignee_id || null; assigneeChange = true;
  }
  if (Object.keys(patch).length === 0) return axErr("no updatable fields provided");
  patch.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from(table).update(patch).eq("id", id).select("*").single();
  if (error) return axErr(error.message);
  if (assigneeChange) {
    const jn = isM ? "meeting_assignees" : "task_assignees";
    const fk = isM ? "meeting_id" : "task_id";
    await supabase.from(jn).delete().eq(fk, id);
    if (assigneeId) await supabase.from(jn).insert([{ [fk]: id, profile_id: assigneeId }]);
  }
  return data;
}
async function axDeleteItem(kind: "task" | "meeting", params: any) {
  const isM = kind === "meeting";
  const idKey = isM ? "meeting_id" : "task_id";
  const id = String(params[idKey] ?? "");
  if (!id) return axErr(`${idKey} is required`);
  const table = isM ? "meetings" : "tasks";
  const { data: existing } = await supabase.from(table).select("id, title").eq("id", id).maybeSingle();
  if (!existing) return axErr(`${idKey} not found`, 404);
  await supabase.from(isM ? "meeting_assignees" : "task_assignees").delete().eq(idKey, id);
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) return axErr(error.message);
  return { deleted: true, [idKey]: id, title: existing.title };
}

const AXYNT_DISPATCH: Record<string, (p: any) => Promise<any>> = {
  list_organizations: async (p) => {
    let q = supabase.from("organizations").select("id, name, org_uid").order("created_at").limit(100);
    if (p?.name) q = q.ilike("name", `%${String(p.name)}%`);
    const { data, error } = await q; return error ? axErr(error.message) : (data ?? []);
  },
  list_members: async (p) => { const o = await axResolveOrg(p); if (axIsErr(o)) return o;
    const { data, error } = await supabase.from("profiles").select("id, full_name, email, role").eq("org_id", o).order("full_name");
    return error ? axErr(error.message) : (data ?? []); },
  list_projects: async (p) => { const o = await axResolveOrg(p); if (axIsErr(o)) return o;
    const { data, error } = await supabase.from("projects").select("id, name").eq("org_id", o).order("name");
    return error ? axErr(error.message) : (data ?? []); },
  list_tasks: async (p) => { const o = await axResolveOrg(p); if (axIsErr(o)) return o;
    let q = supabase.from("tasks").select("id, title, status, priority, due_date, due_time, assignee_id, project_id").eq("org_id", o).order("created_at", { ascending: false }).limit(200);
    if (p.status) q = q.eq("status", String(p.status));
    if (p.assignee_id) q = q.eq("assignee_id", String(p.assignee_id));
    if (p.project_id) q = q.eq("project_id", String(p.project_id));
    const { data, error } = await q; return error ? axErr(error.message) : (data ?? []); },
  list_meetings: async (p) => { const o = await axResolveOrg(p); if (axIsErr(o)) return o;
    let q = supabase.from("meetings").select("id, title, status, priority, meeting_date, meeting_time, assignee_id, project_id").eq("org_id", o).order("created_at", { ascending: false }).limit(200);
    if (p.status) q = q.eq("status", String(p.status));
    if (p.assignee_id) q = q.eq("assignee_id", String(p.assignee_id));
    if (p.project_id) q = q.eq("project_id", String(p.project_id));
    const { data, error } = await q; return error ? axErr(error.message) : (data ?? []); },
  create_task: (p) => axCreateItem("task", p),
  update_task: (p) => axUpdateItem("task", p),
  update_task_status: (p) => axUpdateItem("task", { task_id: p.task_id, status: p.status }),
  delete_task: (p) => axDeleteItem("task", p),
  create_meeting: (p) => axCreateItem("meeting", p),
  update_meeting: (p) => axUpdateItem("meeting", p),
  update_meeting_status: (p) => axUpdateItem("meeting", { meeting_id: p.meeting_id, status: p.status }),
  delete_meeting: (p) => axDeleteItem("meeting", p),
  create_project: async (p) => { const o = await axResolveOrg(p); if (axIsErr(o)) return o;
    const name = String(p.name ?? "").trim(); if (!name) return axErr("name is required");
    const { data, error } = await supabase.from("projects").insert([{ name, description: p.description ?? null, org_id: o, created_by: null }]).select("*").single();
    return error ? axErr(error.message) : data; },
};

const AXYNT_TOOLS = [
  { name: "list_organizations", description: "List workspaces. Call first to get org_id.", params: { name: { type: "string", required: false } } },
  { name: "list_members", description: "People in an org; resolve names to assignee_id.", params: { org_id: { type: "string(uuid)", required: true } } },
  { name: "list_projects", description: "Projects in an org.", params: { org_id: { type: "string(uuid)", required: true } } },
  { name: "list_tasks", description: "Tasks in an org (optional filters).", params: { org_id: { type: "string(uuid)", required: true }, status: { type: "string", required: false, enum: AXYNT_TASK_STATUS }, assignee_id: { type: "string(uuid)", required: false }, project_id: { type: "string(uuid)", required: false } } },
  { name: "list_meetings", description: "Meetings in an org (optional filters).", params: { org_id: { type: "string(uuid)", required: true }, status: { type: "string", required: false, enum: AXYNT_MEET_STATUS }, assignee_id: { type: "string(uuid)", required: false }, project_id: { type: "string(uuid)", required: false } } },
  { name: "create_task", description: "Create a task.", params: { org_id: { type: "string(uuid)", required: true }, title: { type: "string", required: true }, description: { type: "string", required: false }, assignee_id: { type: "string(uuid)", required: false }, project_id: { type: "string(uuid)", required: false }, priority: { type: "string", required: false, enum: AXYNT_PRIORITIES }, due_date: { type: "string(date)", required: false }, due_time: { type: "string(time)", required: false } } },
  { name: "update_task", description: "Update a task.", params: { task_id: { type: "string(uuid)", required: true }, title: { type: "string", required: false }, description: { type: "string", required: false }, assignee_id: { type: "string(uuid)", required: false }, project_id: { type: "string(uuid)", required: false }, priority: { type: "string", required: false, enum: AXYNT_PRIORITIES }, status: { type: "string", required: false, enum: AXYNT_TASK_STATUS }, due_date: { type: "string(date)", required: false }, due_time: { type: "string(time)", required: false } } },
  { name: "update_task_status", description: "Change a task's status.", params: { task_id: { type: "string(uuid)", required: true }, status: { type: "string", required: true, enum: AXYNT_TASK_STATUS } } },
  { name: "delete_task", description: "Delete a task.", params: { task_id: { type: "string(uuid)", required: true } } },
  { name: "create_meeting", description: "Create a meeting.", params: { org_id: { type: "string(uuid)", required: true }, title: { type: "string", required: true }, description: { type: "string", required: false }, assignee_id: { type: "string(uuid)", required: false }, project_id: { type: "string(uuid)", required: false }, priority: { type: "string", required: false, enum: AXYNT_PRIORITIES }, meeting_date: { type: "string(date)", required: false }, meeting_time: { type: "string(time)", required: false } } },
  { name: "update_meeting", description: "Update a meeting.", params: { meeting_id: { type: "string(uuid)", required: true }, title: { type: "string", required: false }, description: { type: "string", required: false }, assignee_id: { type: "string(uuid)", required: false }, project_id: { type: "string(uuid)", required: false }, priority: { type: "string", required: false, enum: AXYNT_PRIORITIES }, status: { type: "string", required: false, enum: AXYNT_MEET_STATUS }, meeting_date: { type: "string(date)", required: false }, meeting_time: { type: "string(time)", required: false } } },
  { name: "update_meeting_status", description: "Change a meeting's status.", params: { meeting_id: { type: "string(uuid)", required: true }, status: { type: "string", required: true, enum: AXYNT_MEET_STATUS } } },
  { name: "delete_meeting", description: "Delete a meeting.", params: { meeting_id: { type: "string(uuid)", required: true } } },
  { name: "create_project", description: "Create a project.", params: { org_id: { type: "string(uuid)", required: true }, name: { type: "string", required: true }, description: { type: "string", required: false } } },
];

// Inbound: Axynt's agent calls TaskFlow tools. HMAC-verified, fail-closed.
async function handleAiCallback(req: Request): Promise<Response> {
  const secret = await axyntSecret();
  if (!secret) return json({ error: "AI callback is not configured" }, 503);
  const raw = await req.text();
  const header = req.headers.get("x-signature") || "";
  const provided = (header.startsWith("sha256=") ? header.slice(7) : header).trim().toLowerCase();
  const expected = await axyntHmacHex(secret, raw);
  if (!provided || !axyntSafeEqual(provided, expected)) return json({ error: "Invalid signature" }, 401);
  let body: any;
  try { body = JSON.parse(raw || "{}"); } catch { return json({ error: "Invalid JSON body" }, 400); }
  if (body.action === "list_tools") return json({ tools: AXYNT_TOOLS });
  const tool = String(body.tool || req.headers.get("x-axyntai-tool") || "");
  const fn = AXYNT_DISPATCH[tool];
  if (!fn) return json({ error: `Unknown tool: ${tool || "(none)"}` }, 400);
  try {
    const out = await fn(body.params || {});
    if (axIsErr(out)) return json({ error: out.__error }, out.__status || 400);
    return json({ result: out });
  } catch (e) {
    return json({ error: (e as Error)?.message || "Tool execution failed" }, 400);
  }
}

// Outbound: TaskFlow sends a signed message to Axynt's inbound webhook.
async function postToAxynt(payload: any): Promise<{ ok: boolean; status: number; data: any }> {
  const url = await axyntInboundUrl();
  const secret = await axyntSecret();
  if (!url || !secret) return { ok: false, status: 503, data: { error: "Axynt outbound not configured" } };
  const raw = JSON.stringify(payload ?? {});
  const sig = await axyntHmacHex(secret, raw);
  const r = await fetchTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Signature": `sha256=${sig}` },
    body: raw,
  }, 30000);
  if (!r) return { ok: false, status: 504, data: { error: "Axynt request timed out" } };
  let data: any = null; try { data = await r.json(); } catch { /* non-JSON */ }
  return { ok: r.ok, status: r.status, data };
}
async function handleAxyntSend(req: Request): Promise<Response> {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const body = await parseBody(req) as any;
  const message = String(body?.message ?? "").trim();
  if (!message) return json({ error: "message is required" }, 400);
  const r = await postToAxynt({ message, source: "taskflow", user_id: auth.user.id, org_id: auth.user.org_id });
  if (!r.ok) return json({ error: r.data?.error || "Axynt request failed", status: r.status }, r.status >= 400 ? r.status : 502);
  return json({ ok: true, response: r.data?.response ?? "", raw: r.data });
}

const WA_AI_INTRO = `🤖 *TaskFlow‑AI* is on!

Just tell me what to do in plain language — e.g.
• _add a task to call the client tomorrow, high priority, assign to Preet_
• _mark the invoice task as done_
• _change the dashboard task due date to 25-07-2026_
• _create a project called Website Revamp_
• _what's overdue this week?_

I can add, change or delete tasks, meetings, projects and users — within your permissions.

_Send *menu* to go back._`;

// Thin wrapper: verify the shared secret, then hand off to background processing and
// return 200 IMMEDIATELY. The box is often overloaded so send-text can take 10-30s; if we
// blocked the response on it, OpenWA would time out and RETRY the webhook (we saw the same
// "/taskflow" delivered 3x), causing duplicate replies and state churn.
async function handleWhatsAppWebhook(req: Request): Promise<Response> {
  const secret = await waWebhookSecret();
  if (secret && (req.headers.get("x-taskflow-secret") || "") !== secret) return new Response("forbidden", { status: 403 });
  let body: any = {};
  try { body = await req.json(); } catch { return new Response("ok"); }
  // Process synchronously but with bounded fetch timeouts (see fetchTimeout): the edge
  // supervisor kills background/waitUntil work on this box, so we must finish before
  // responding. Bounded sends keep total well under OpenWA's webhook retry window.
  try { await processWhatsAppMessage(body); } catch (e) { console.error("[whatsapp]", (e as Error)?.message); }
  return new Response("ok");
}

// Actual conversation state machine. Runs in the background; its return values are ignored
// (the `return new Response("ok")` statements simply short-circuit the flow).
async function processWhatsAppMessage(body: any): Promise<void> {
  const msg = body?.data?.message ?? body?.message ?? body?.data ?? body;
  if (msg?.fromMe === true || msg?.direction === "outgoing" || msg?.direction === "outbound") return new Response("ok");
  // Idempotency: our reply is synchronous, and a slow one (AI create ≈ 12s) makes OpenWA
  // re-deliver the webhook — processing the same message twice (duplicate task). Claim the
  // message id once; a retry hits the unique constraint (23505) and is skipped. Fail-open:
  // any other error (e.g. table missing) still processes, so the bot never gets stuck.
  const _mid = String(msg?.id ?? msg?.waMessageId ?? "").trim() ||
    `${msg?.from ?? ""}|${msg?.timestamp ?? ""}|${String(msg?.body ?? "").slice(0, 40)}`;
  const { error: _dupErr } = await supabase.from("wa_processed").insert({ msg_id: _mid });
  if (_dupErr && ((_dupErr as any).code === "23505" || /duplicate|already exists/i.test((_dupErr as any).message || ""))) return new Response("ok"); // duplicate delivery — skip
  const text = String(msg?.body ?? msg?.text ?? msg?.content ?? "").trim();
  const senderDigits = await waResolveSenderPhone(msg?.from ?? msg?.chatId ?? msg?.author ?? "");
  if (!senderDigits || !text) return new Response("ok");

  const profile = await waFindProfileByPhone(senderDigits);
  console.log(`[wa] in="${text.slice(0, 24)}" sender=${senderDigits} profile=${profile?.email || "NONE"}`);
  if (!profile || !profile.org_id) return new Response("ok"); // unknown number -> silent ignore

  const replyTo = `${senderDigits}@c.us`;
  const reply = async (t: string) => {
    console.log(`[wa] -> send to ${replyTo}: ${t.slice(0, 24)}`);
    await openwaSendText(replyTo, t);
    console.log(`[wa] <- sent to ${replyTo}`);
  };
  const { data: convRow } = await supabase.from("wa_conversations").select("state, draft").eq("phone", senderDigits).maybeSingle();
  const state = convRow?.state || "idle";
  const draft: any = convRow?.draft || {};
  const save = (s: string, d: any) => supabase.from("wa_conversations").upsert({ phone: senderDigits, profile_id: profile.id, state: s, draft: d, updated_at: new Date().toISOString() }, { onConflict: "phone" });
  const clear = () => supabase.from("wa_conversations").delete().eq("phone", senderDigits);
  const low = text.toLowerCase();

  if (low === "/cancel" || low === "cancel") { await clear(); await reply("❌ Cancelled. Send */taskflow* to start again."); return new Response("ok"); }
  const isTrigger = low === "/taskflow" || low === "/task" || low === "/meeting" || low === "/start" || low === "/calendar" || low === "/ai" || low === "/taskflow-ai";
  if (state === "idle" && !isTrigger) { await reply(`👋 Hi ${profile.full_name || "there"}! Send *"/taskflow"* to create a task/meeting, view your calendar, or use 🤖 TaskFlow‑AI.`); return new Response("ok"); }
  if (isTrigger) {
    if (low === "/task") { await save("title", { kind: "task" }); await reply("👋 New *Task*.\n\n📝 What's the *title*?\n_(send *cancel* anytime)_"); return new Response("ok"); }
    if (low === "/meeting") { await save("title", { kind: "meeting" }); await reply("👋 New *Meeting*.\n\n📝 What's the *title*?\n_(send *cancel* anytime)_"); return new Response("ok"); }
    if (low === "/calendar") { await clear(); await reply(await waBuildCalendar(profile)); return new Response("ok"); }
    if (low === "/ai" || low === "/taskflow-ai") { await save("ai", {}); await reply(WA_AI_INTRO); return new Response("ok"); }
    await save("kind", {});
    await reply(`👋 Hi ${profile.full_name || "there"}! What would you like to do?\n\n1️⃣  New Task\n2️⃣  New Meeting\n3️⃣  View Calendar\n4️⃣  TaskFlow‑AI 🤖\n\n_Reply *1*, *2*, *3* or *4* (or type: task / meeting / calendar / ai). Send *cancel* anytime._`);
    return new Response("ok");
  }
  if (state === "ai") {
    if (["menu", "exit", "back", "/menu"].includes(low)) {
      await save("kind", {});
      await reply(`👋 Back to menu. What would you like to do?\n\n1️⃣  New Task\n2️⃣  New Meeting\n3️⃣  View Calendar\n4️⃣  TaskFlow‑AI 🤖\n\nReply *1*, *2*, *3* or *4*.`);
      return new Response("ok");
    }
    const ans = await runAiAssistant({ id: profile.id, email: profile.email, role: profile.role, org_id: profile.org_id }, text);
    await reply(`${ans}\n\n_🤖 TaskFlow‑AI — send *menu* to exit._`);
    return new Response("ok");
  }
  if (state === "kind") {
    let choice: string | null = null;
    const numChoice = (text.match(/[1-4]/) || [""])[0]; // tolerate "4", "4️⃣", "option 4", etc.
    if (numChoice === "1" || low === "task") choice = "task";
    else if (numChoice === "2" || low === "meeting") choice = "meeting";
    else if (numChoice === "3" || low.startsWith("cal") || low === "view" || low === "calender") choice = "calendar";
    else if (numChoice === "4" || low === "ai" || low.includes("taskflow-ai") || low.includes("taskflow ai")) choice = "ai";
    if (!choice) { await reply("Please reply *1* (Task), *2* (Meeting), *3* (View Calendar) or *4* (TaskFlow‑AI)."); return new Response("ok"); }
    if (choice === "calendar") { await clear(); await reply(await waBuildCalendar(profile)); return new Response("ok"); }
    if (choice === "ai") { await save("ai", {}); await reply(WA_AI_INTRO); return new Response("ok"); }
    draft.kind = choice; await save("title", draft); await reply(`📝 What's the *title* of the ${choice}?`); return new Response("ok");
  }
  if (state === "title") {
    draft.title = text.slice(0, 200); await save("desc", draft); await reply("🗒️ Add a *description*? Send it, or reply *skip*."); return new Response("ok");
  }
  if (state === "desc") {
    draft.description = low === "skip" ? "" : text.slice(0, 1000);
    const { data: projs } = await supabase.from("projects").select("id, name").eq("org_id", profile.org_id).order("name");
    draft._projects = (projs || []).map((p: any) => ({ id: p.id, name: p.name || "Untitled" }));
    await save("project", draft);
    const listTxt = (draft._projects as any[]).map((p, i) => `${i + 1}.  ${p.name}`).join("\n");
    await reply(`📁 Which *project*?\n\n0.  None${listTxt ? "\n" + listTxt : ""}\n\nReply with the number.`); return new Response("ok");
  }
  if (state === "project") {
    const projs: any[] = draft._projects || [];
    if (text.trim() === "0" || low === "none") { draft.project_id = null; draft.project_name = null; }
    else {
      const idx = parseInt(text, 10) - 1;
      if (Number.isNaN(idx) || idx < 0 || idx >= projs.length) { await reply("Please reply with a valid project number (*0* for None)."); return new Response("ok"); }
      draft.project_id = projs[idx].id; draft.project_name = projs[idx].name;
    }
    await save("priority", draft);
    await reply("🚦 *Priority*?\n\n1  Low\n2  Medium\n3  High\n\nReply 1 / 2 / 3."); return new Response("ok");
  }
  if (state === "priority") {
    draft.priority = /^1/.test(text) ? "low" : /^3/.test(text) ? "high" : "medium"; await save("date", draft);
    const label = draft.kind === "meeting" ? "meeting date" : "due date";
    await reply(`📅 What's the *${label}*? Send *DD-MM-YYYY* (e.g. 20-07-2026), or reply *skip*.`); return new Response("ok");
  }
  if (state === "date") {
    let date: string | null = null;
    if (low !== "skip") {
      date = waParseDate(text);
      if (!date) { await reply("Please use *DD-MM-YYYY* (e.g. 20-07-2026), or reply *skip*."); return new Response("ok"); }
    }
    draft.date = date;
    const { data: users } = await supabase.from("profiles").select("id, full_name, email").eq("org_id", profile.org_id).order("full_name");
    draft._users = (users || []).map((u: any) => ({ id: u.id, name: u.full_name || u.email }));
    await save("assignee", draft);
    const listTxt = (draft._users as any[]).map((u, i) => `${i + 1}.  ${u.name}`).join("\n");
    await reply(`👤 *Assign to* whom?\n\n0.  Myself\n${listTxt}\n\nReply with the number.`); return new Response("ok");
  }
  if (state === "assignee") {
    const users: any[] = draft._users || [];
    let assigneeId: string | null = null;
    if (text.trim() === "0") assigneeId = profile.id;
    else {
      const idx = parseInt(text, 10) - 1;
      if (Number.isNaN(idx) || idx < 0 || idx >= users.length) { await reply("Please reply with a valid number from the list."); return new Response("ok"); }
      assigneeId = users[idx].id;
    }
    draft.assignee_id = assigneeId;
    draft.assignee_name = assigneeId === profile.id ? "Myself" : (users.find((u) => u.id === assigneeId)?.name || "the assignee");
    await save("confirm", draft);
    await reply(waSummary(draft)); return new Response("ok");
  }
  if (state === "confirm") {
    if (low === "confirm" || low === "yes" || low === "ok" || low === "y") {
      const res = await waCreateItem(draft, profile, draft.assignee_id);
      await clear();
      if (res.error) { await reply(`⚠️ Sorry, couldn't create it: ${res.error}`); return new Response("ok"); }
      const kindLabel = draft.kind === "meeting" ? "Meeting" : "Task";
      await reply(`✅ *${kindLabel} created!*\n\n*${draft.title}*\n• Project: ${draft.project_name || "None"}\n• Priority: ${capWord(draft.priority || "medium")}\n• ${draft.kind === "meeting" ? "Date" : "Due"}: ${waFmtDate(draft.date)}\n• Assigned to: ${draft.assignee_name}\n\nIt's now live in TaskFlow. 🎉`);
      return new Response("ok");
    }
    await reply("Reply *confirm* ✅ to create, or *cancel* ❌ to discard."); return new Response("ok");
  }
  return new Response("ok");
}

type AppUser = {
  id: string;
  email?: string;
  role: "admin" | "employee";
  org_id: string | null;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function stripApiPrefix(pathname: string) {
  return pathname
    .replace(/^\/functions\/v1\/api/, "")
    .replace(/^\/api/, "") || "/";
}

async function parseBody(req: Request) {
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) return await req.json();
  return {};
}

// Per-boot random secret for in-process AI dispatch impersonation. It never leaves the
// process, so external callers cannot forge the x-internal-* headers to impersonate a user.
const INTERNAL_SECRET = crypto.randomUUID();
async function getAuthUser(req: Request): Promise<AppUser | null> {
  const internalSecret = req.headers.get("x-internal-secret");
  if (internalSecret) {
    if (internalSecret !== INTERNAL_SECRET) return null;
    const uid = req.headers.get("x-internal-user") || "";
    if (!uid) return null;
    const { data: ip } = await supabase.from("profiles").select("email, role, org_id").eq("id", uid).maybeSingle();
    if (!ip) return null;
    return { id: uid, email: (ip as any).email, role: (ip as any).role, org_id: (ip as any).org_id };
  }
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  let { data: profile } = await supabase
    .from("profiles")
    .select("role, org_id")
    .eq("id", data.user.id)
    .maybeSingle();

  // First login via an external provider (Google) has no profile row yet. Create a
  // minimal one (no org) so the app can route the user into onboarding.
  if (!profile) {
    const meta = (data.user.user_metadata ?? {}) as Record<string, string>;
    const fullName = meta.full_name || meta.name || (data.user.email ?? "").split("@")[0] || "New user";
    const { data: created } = await supabase
      .from("profiles")
      .insert([{ id: data.user.id, email: data.user.email, full_name: fullName, role: "employee", org_id: null }])
      .select("role, org_id")
      .maybeSingle();
    profile = created ?? { role: "employee", org_id: null } as any;
  }

  if (!profile) return null;

  return {
    id: data.user.id,
    email: data.user.email,
    role: profile.role,
    org_id: profile.org_id,
  };
}

/**
 * Employees invited before org_id was always set can have null org_id while still
 * having task_assignees / meeting_assignees rows. `.eq("org_id", null)` then returns
 * no rows — dashboards look "empty" and PATCH fails. Derive org from assignments once.
 */
async function hydrateEmployeeOrg(user: AppUser): Promise<AppUser> {
  if (user.org_id || user.role !== "employee") return user;

  const { data: ta } = await supabase.from("task_assignees").select("task_id").eq("profile_id", user.id).limit(1).maybeSingle();
  let oid: string | null = null;
  if (ta?.task_id) {
    const { data: t } = await supabase.from("tasks").select("org_id").eq("id", ta.task_id).maybeSingle();
    oid = (t as { org_id?: string } | null)?.org_id ?? null;
  }
  if (!oid) {
    const { data: ma } = await supabase.from("meeting_assignees").select("meeting_id").eq("profile_id", user.id).limit(1).maybeSingle();
    if (ma?.meeting_id) {
      const { data: m } = await supabase.from("meetings").select("org_id").eq("id", ma.meeting_id).maybeSingle();
      oid = (m as { org_id?: string } | null)?.org_id ?? null;
    }
  }
  if (oid) {
    await supabase.from("profiles").update({ org_id: oid }).eq("id", user.id);
    return { ...user, org_id: oid };
  }
  return user;
}

async function requireAuth(req: Request): Promise<{ error: Response } | { user: AppUser }> {
  const user = await getAuthUser(req);
  if (!user) return { error: json({ error: "Unauthorized" }, 401) };
  const hydrated = await hydrateEmployeeOrg(user);
  return { user: hydrated };
}

function requireAdmin(user: AppUser) {
  if (user.role !== "admin") return json({ error: "Admin access required" }, 403);
  return null;
}

function taskAssigneeIds(t: any): string[] {
  const fromJ = (t.task_assignees ?? []).map((x: any) => x.profile_id).filter(Boolean);
  if (t.assignee_id && !fromJ.includes(t.assignee_id)) return [t.assignee_id, ...fromJ];
  return fromJ.length ? fromJ : (t.assignee_id ? [t.assignee_id] : []);
}

function meetingAssigneeIds(m: any): string[] {
  const fromJ = (m.meeting_assignees ?? []).map((x: any) => x.profile_id).filter(Boolean);
  if (m.assignee_id && !fromJ.includes(m.assignee_id)) return [m.assignee_id, ...fromJ];
  return fromJ.length ? fromJ : (m.assignee_id ? [m.assignee_id] : []);
}

// ─────────────────────────────────────────────────────────────────────────────
// History audit log helpers. Writes are fire-and-forget — a logging failure
// must never break the underlying mutation, so we swallow errors and log them.
// ─────────────────────────────────────────────────────────────────────────────

type HistoryChanges = Record<string, unknown>;

async function logTaskHistory(
  taskId: string,
  actorId: string | null,
  orgId: string | null,
  action: string,
  changes: HistoryChanges,
  note: string | null,
): Promise<void> {
  try {
    const { error } = await supabase.from("task_history").insert([{
      task_id: taskId,
      actor_id: actorId,
      org_id: orgId,
      action,
      changes: changes ?? {},
      note: note ?? null,
    }]);
    if (error) console.warn("[history] task_history insert failed:", error.message);
  } catch (err) {
    console.warn("[history] task_history insert threw:", (err as Error)?.message);
  }
}

async function logMeetingHistory(
  meetingId: string,
  actorId: string | null,
  orgId: string | null,
  action: string,
  changes: HistoryChanges,
  note: string | null,
): Promise<void> {
  try {
    const { error } = await supabase.from("meeting_history").insert([{
      meeting_id: meetingId,
      actor_id: actorId,
      org_id: orgId,
      action,
      changes: changes ?? {},
      note: note ?? null,
    }]);
    if (error) console.warn("[history] meeting_history insert failed:", error.message);
  } catch (err) {
    console.warn("[history] meeting_history insert threw:", (err as Error)?.message);
  }
}

function scheduleAudit(fn: () => Promise<void>): void {
  queueMicrotask(() => {
    fn().catch((e) => console.error("[history]", e));
  });
}

/** Shallow diff: which keys in `patch` differ from `before`. Skips `updated_at`. */
function diffForHistory(
  before: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of Object.keys(patch)) {
    if (k === "updated_at") continue;
    const a = before?.[k] ?? null;
    const b = patch[k] ?? null;
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      out[k] = { from: a, to: b };
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV-import helpers. Used by POST /tasks/import + POST /meetings/import.
// Goal: be forgiving of column-name variations, date formats, and assignee
// reference styles (email OR full name) so an admin can paste a CSV that
// someone else exported from any tool and get sensible imports.
// ─────────────────────────────────────────────────────────────────────────────

/** lowercase, strip non-alphanum so "Due Date" / "due_date" / "duedate" match */
function normKey(s: string): string {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Header synonym groups → canonical field name */
const HEADER_SYNONYMS: Record<string, string[]> = {
  title:        ["title", "name", "task", "meeting", "subject", "summary"],
  description:  ["description", "desc", "details", "notes", "info", "message", "body"],
  priority:     ["priority", "pri", "importance", "urgency"],
  status:       ["status", "state"],
  due_date:     ["duedate", "due", "deadline", "targetdate", "date"],
  due_time:     ["duetime", "time", "hour"],
  meeting_date: ["meetingdate", "scheduleddate", "date", "when"],
  meeting_time: ["meetingtime", "time", "hour", "at"],
  assignees:    ["assignees", "assignee", "assignedto", "owner", "owners", "members", "people", "who", "emails", "email"],
  project:      ["project", "projectname"],
};

/** Build a canonical-row → original-key map for a row of strings */
function canonicalize(row: Record<string, unknown>, kind: "task" | "meeting"): Record<string, string> {
  const out: Record<string, string> = {};
  const keys = Object.keys(row);
  const want = kind === "task"
    ? ["title", "description", "priority", "status", "due_date", "due_time", "assignees", "project"]
    : ["title", "description", "priority", "status", "meeting_date", "meeting_time", "assignees", "project"];

  for (const canonical of want) {
    const synonyms = HEADER_SYNONYMS[canonical] || [canonical];
    let value = "";
    for (const k of keys) {
      const nk = normKey(k);
      if (synonyms.includes(nk)) {
        value = String(row[k] ?? "").trim();
        if (value) break;
      }
    }
    out[canonical] = value;
  }
  return out;
}

/** Try multiple date formats. Returns yyyy-mm-dd or "" on failure. */
function parseFlexDate(input: string): string {
  const s = String(input || "").trim();
  if (!s) return "";

  // ISO: yyyy-mm-dd
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;

  // dd/mm/yyyy or dd-mm-yyyy (our app default)
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) {
    const dd = Number(m[1]), mm = Number(m[2]), yyyy = m[3];
    // Disambiguate: if dd > 12, must be dd/mm/yyyy. If mm > 12, must be mm/dd/yyyy.
    if (mm > 12 && dd <= 12) return `${yyyy}-${String(dd).padStart(2, "0")}-${String(mm).padStart(2, "0")}`;
    return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  }

  // "20 May 2026" or "May 20 2026" or "20-May-2026"
  const months: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  const lower = s.toLowerCase();
  m = lower.match(/^(\d{1,2})\s+([a-z]{3,9})\s+(\d{4})$/) ||
      lower.match(/^(\d{1,2})-([a-z]{3,9})-(\d{4})$/);
  if (m) {
    const dd = m[1].padStart(2, "0");
    const mon = months[m[2].slice(0, 3)];
    if (mon) return `${m[3]}-${mon}-${dd}`;
  }
  m = lower.match(/^([a-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m) {
    const mon = months[m[1].slice(0, 3)];
    if (mon) return `${m[3]}-${mon}-${m[2].padStart(2, "0")}`;
  }

  // Last resort: let JS try
  const d = new Date(s);
  if (Number.isFinite(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return "";
}

/** Returns HH:MM (24-hour) or "" on failure. Supports "6:00 PM", "18:00", "6pm" */
function parseFlexTime(input: string): string {
  const s = String(input || "").trim().toLowerCase();
  if (!s) return "";

  // 24-hour HH:MM[:SS]
  let m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (m) {
    const h = Number(m[1]), mm = Number(m[2]);
    if (h >= 0 && h < 24 && mm >= 0 && mm < 60) {
      return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    }
  }

  // 12-hour with am/pm — "6:00 pm", "6 pm", "12:30am"
  m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (m) {
    let h = Number(m[1]);
    const mm = Number(m[2] || "0");
    const period = m[3];
    if (h < 1 || h > 12 || mm < 0 || mm > 59) return "";
    if (period === "pm" && h !== 12) h += 12;
    if (period === "am" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }
  return "";
}

const VALID_PRIORITIES = new Set(["low", "medium", "high"]);
function parsePriority(s: string): string {
  const v = String(s || "").toLowerCase().trim();
  if (VALID_PRIORITIES.has(v)) return v;
  if (v === "med" || v === "m" || v === "normal" || v === "") return "medium";
  if (v === "h" || v === "urgent" || v === "important") return "high";
  if (v === "l" || v === "minor") return "low";
  return "medium";
}

/**
 * Resolve assignee references in the org. Accepts a comma- or
 * semicolon-separated list of emails OR full names. Returns matched profile IDs,
 * the original tokens that couldn't be resolved, and a count.
 */
async function resolveAssignees(orgId: string, raw: string): Promise<{ ids: string[]; unresolved: string[] }> {
  const tokens = String(raw || "")
    .split(/[,;]/g)
    .map((t) => t.trim())
    .filter(Boolean);

  if (!tokens.length) return { ids: [], unresolved: [] };

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("org_id", orgId);

  const ids: string[] = [];
  const unresolved: string[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    const lower = token.toLowerCase();
    const match = (profiles || []).find(
      (p: { id: string; email: string | null; full_name: string | null }) =>
        (p.email && p.email.toLowerCase() === lower) ||
        (p.full_name && p.full_name.toLowerCase() === lower),
    );
    if (match && !seen.has(match.id)) {
      ids.push(match.id);
      seen.add(match.id);
    } else if (!match) {
      unresolved.push(token);
    }
  }
  return { ids, unresolved };
}

/** Resolve project name (case-insensitive) to a project id within the org. */
async function resolveProject(orgId: string, name: string): Promise<string | null> {
  const v = String(name || "").trim();
  if (!v) return null;
  const { data } = await supabase
    .from("projects")
    .select("id, name")
    .eq("org_id", orgId)
    .ilike("name", v)
    .maybeSingle();
  return (data as { id?: string } | null)?.id || null;
}

async function loadOrgRoleByIdForEdge(orgId: string): Promise<Record<string, string>> {
  const { data, error } = await supabase.from("profiles").select("id, role").eq("org_id", orgId);
  if (error) throw error;
  const roleById: Record<string, string> = {};
  for (const p of (data ?? []) as { id: string; role: string }[]) {
    roleById[String(p.id)] = String(p.role);
  }
  return roleById;
}

/** Admin-only assignee roster: hide from other admins unless creator/participant */
function edgeAdminSeesItem(
  row: any,
  viewerId: string,
  roleById: Record<string, string>,
  mode: "task" | "meeting",
): boolean {
  const assignees = mode === "task" ? taskAssigneeIds(row) : meetingAssigneeIds(row);
  if (assignees.length === 0) return true;
  const restricted = assignees.every((id) => roleById[id] === "admin");
  if (!restricted) return true;
  if (row.created_by === viewerId) return true;
  return assignees.includes(viewerId);
}

function meetingCanBeAccessedBy(user: AppUser, meeting: any) {
  if (!meeting) return false;
  if (user.role === "admin") {
    if (user.org_id && meeting.org_id !== user.org_id) return false;
    return true;
  }
  if (user.org_id && meeting.org_id !== user.org_id) return false;
  return meetingAssigneeIds(meeting).includes(user.id);
}

function normalizeAssigneeIds(body: any): string[] {
  const raw = body.assignee_ids ?? body.assigneeIds;
  if (Array.isArray(raw)) {
    return [...new Set(raw.filter((id: unknown) => typeof id === "string" && (id as string).length > 0) as string[])];
  }
  if (body.assignee_id) return [String(body.assignee_id)];
  return [];
}

function shapeTask(row: any) {
  if (!row) return row;
  const { task_assignees: _ta, projects: _pr, ...rest } = row;
  const assignee_ids = taskAssigneeIds(row);
  const project_name = row.projects?.name ?? null;
  return { ...rest, assignee_ids, project_name };
}

function shapeMeeting(row: any) {
  if (!row) return row;
  const { meeting_assignees: _ma, projects: _pr, ...rest } = row;
  const assignee_ids = meetingAssigneeIds(row);
  const project_name = row.projects?.name ?? null;
  return { ...rest, assignee_ids, project_name };
}

/** Sort in-process so we do not rely on PostgREST `.order("created_at")` (400 if column is missing or not exposed). */
function sortByCreatedAtDesc<T extends { created_at?: string | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
}

/** Avoid PostgREST resource-embed failures (400) on some self-hosted / cache setups. */
const ROW_IN_CHUNK = 120;

async function loadTaskAssigneesByTaskIds(taskIds: string[]): Promise<Map<string, { profile_id: string }[]>> {
  const map = new Map<string, { profile_id: string }[]>();
  const unique = [...new Set(taskIds.filter(Boolean))];
  for (let i = 0; i < unique.length; i += ROW_IN_CHUNK) {
    const slice = unique.slice(i, i + ROW_IN_CHUNK);
    const { data, error } = await supabase.from("task_assignees").select("task_id, profile_id").in("task_id", slice);
    if (error || !data) continue;
    for (const row of data as { task_id: string; profile_id: string }[]) {
      const list = map.get(row.task_id) ?? [];
      list.push({ profile_id: row.profile_id });
      map.set(row.task_id, list);
    }
  }
  return map;
}

async function loadMeetingAssigneesByMeetingIds(meetingIds: string[]): Promise<Map<string, { profile_id: string }[]>> {
  const map = new Map<string, { profile_id: string }[]>();
  const unique = [...new Set(meetingIds.filter(Boolean))];
  for (let i = 0; i < unique.length; i += ROW_IN_CHUNK) {
    const slice = unique.slice(i, i + ROW_IN_CHUNK);
    const { data, error } = await supabase.from("meeting_assignees").select("meeting_id, profile_id").in(
      "meeting_id",
      slice,
    );
    if (error || !data) continue;
    for (const row of data as { meeting_id: string; profile_id: string }[]) {
      const list = map.get(row.meeting_id) ?? [];
      list.push({ profile_id: row.profile_id });
      map.set(row.meeting_id, list);
    }
  }
  return map;
}

async function loadProjectNames(projectIds: string[]): Promise<Map<string, string>> {
  const uniq = [...new Set(projectIds.filter((id): id is string => typeof id === "string" && id.length > 0))];
  const m = new Map<string, string>();
  if (!uniq.length) return m;
  for (let i = 0; i < uniq.length; i += ROW_IN_CHUNK) {
    const slice = uniq.slice(i, i + ROW_IN_CHUNK);
    const { data, error } = await supabase.from("projects").select("id, name").in("id", slice);
    if (error || !data) continue;
    for (const p of data as { id: string; name: string }[]) {
      m.set(p.id, p.name);
    }
  }
  return m;
}

async function shapeTasksWithJoins(rows: any[] | null): Promise<any[]> {
  const list = rows ?? [];
  if (!list.length) return [];
  const ids = list.map((r) => r.id).filter(Boolean);
  const projectIds = list.map((r) => r.project_id).filter(Boolean) as string[];
  const [assigneeMap, nameMap] = await Promise.all([
    loadTaskAssigneesByTaskIds(ids),
    loadProjectNames(projectIds),
  ]);
  return list.map((row) => {
    const task_assignees = assigneeMap.get(row.id) ?? [];
    const pn = row.project_id ? nameMap.get(row.project_id) : undefined;
    const projects = pn !== undefined ? { name: pn } : null;
    return shapeTask({ ...row, task_assignees, projects });
  });
}

async function shapeMeetingsWithJoins(rows: any[] | null): Promise<any[]> {
  const list = rows ?? [];
  if (!list.length) return [];
  const ids = list.map((r) => r.id).filter(Boolean);
  const projectIds = list.map((r) => r.project_id).filter(Boolean) as string[];
  const [assigneeMap, nameMap] = await Promise.all([
    loadMeetingAssigneesByMeetingIds(ids),
    loadProjectNames(projectIds),
  ]);
  return list.map((row) => {
    const meeting_assignees = assigneeMap.get(row.id) ?? [];
    const pn = row.project_id ? nameMap.get(row.project_id) : undefined;
    const projects = pn !== undefined ? { name: pn } : null;
    return shapeMeeting({ ...row, meeting_assignees, projects });
  });
}

/** Row + assignees for access checks (no embed). orgIdFilter: omit org filter when null/undefined. */
async function fetchMeetingWithAssignees(meetingId: string, orgIdFilter: string | null): Promise<any | null> {
  let q = supabase.from("meetings").select("*").eq("id", meetingId);
  if (orgIdFilter) q = q.eq("org_id", orgIdFilter);
  const { data: row } = await q.maybeSingle();
  if (!row) return null;
  const { data: ra } = await supabase.from("meeting_assignees").select("profile_id").eq("meeting_id", meetingId);
  const meeting_assignees = (ra ?? []).map((r: { profile_id: string }) => ({ profile_id: r.profile_id }));
  return { ...row, meeting_assignees };
}

async function fetchTasksByIdsChunked(taskIds: string[]): Promise<{ rows: any[]; error: { message: string } | null }> {
  const unique = [...new Set(taskIds.filter(Boolean))];
  const rows: any[] = [];
  for (let i = 0; i < unique.length; i += ROW_IN_CHUNK) {
    const slice = unique.slice(i, i + ROW_IN_CHUNK);
    const { data, error } = await supabase.from("tasks").select("*").in("id", slice);
    if (error) return { rows: [], error };
    rows.push(...(data ?? []));
  }
  rows.sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
  return { rows, error: null };
}

async function fetchMeetingsByIdsChunked(meetingIds: string[]): Promise<{ rows: any[]; error: { message: string } | null }> {
  const unique = [...new Set(meetingIds.filter(Boolean))];
  const rows: any[] = [];
  for (let i = 0; i < unique.length; i += ROW_IN_CHUNK) {
    const slice = unique.slice(i, i + ROW_IN_CHUNK);
    const { data, error } = await supabase.from("meetings").select("*").in("id", slice);
    if (error) return { rows: [], error };
    rows.push(...(data ?? []));
  }
  rows.sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
  return { rows, error: null };
}

async function handleAuthSignup(req: Request) {
  const body = await parseBody(req);
  const { email, password, fullName } = body as any;
  if (!email || !password || !fullName) return json({ error: "Missing required fields: email, password, fullName" }, 400);

  const { data: created, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) return json({ error: error.message }, error.status || 400);

  const user = created.user;
  // No org yet — the signup wizard (verify phone -> create org OR join by 6-digit code)
  // decides. Admin-created users (POST /admin/users) still get an org immediately.
  if (user) {
    await supabase.from("profiles").upsert(
      { id: user.id, email, full_name: fullName, role: "employee", org_id: null },
      { onConflict: "id" },
    );
  }

  const authClient = createAuthClient();
  const { data: loginData } = await authClient.auth.signInWithPassword({ email, password });
  return json({
    message: "User created successfully",
    user: loginData?.user ?? user,
    session: loginData?.session ?? null,
  }, 201);
}

async function handleAuthLogin(req: Request) {
  const body = await parseBody(req);
  const { email, password } = body as any;
  if (!email || !password) return json({ error: "Missing required fields: email, password" }, 400);

  const authClient = createAuthClient();
  const { data, error } = await authClient.auth.signInWithPassword({ email, password });
  if (error) return json({ error: "Invalid credentials" }, 401);

  const user = data.user;
  if (user) {
    const { data: existing } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    let orgId = existing?.org_id ?? null;
    const role = existing?.role ?? (user.user_metadata?.role === "admin" ? "admin" : "employee");

    if (!orgId && role === "admin") {
      const { data: org } = await supabase
        .from("organizations")
        .insert([{ name: `${user.user_metadata?.full_name || user.email}'s workspace` }])
        .select("id")
        .single();
      orgId = org?.id ?? null;
    }

    await supabase.from("profiles").upsert(
      {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || existing?.full_name || "",
        role,
        org_id: orgId,
      },
      { onConflict: "id" },
    );
  }

  return json({
    message: "Login successful",
    user: data.user,
    session: data.session,
  });
}

async function handleAuthMe(req: Request) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (error) return json({ error: error.message }, 500);

  // Onboarding routing info (additive — existing fields are unchanged).
  let org: any = null;
  if (data.org_id) {
    const { data: o } = await supabase.from("organizations").select("id, name, org_uid").eq("id", data.org_id).maybeSingle();
    org = o ?? null;
  }
  let joinRequest: any = null;
  if (!data.org_id) {
    const { data: jr } = await supabase.from("org_join_requests")
      .select("id, status, org_id, created_at").eq("profile_id", user.id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    joinRequest = jr ?? null;
  }
  const status = data.org_id
    ? "active"
    : joinRequest?.status === "pending"
      ? "pending_approval"
      : joinRequest?.status === "rejected"
        ? "rejected"
        : "needs_onboarding";

  return json({ ...data, org, join_request: joinRequest, status, needs_onboarding: status === "needs_onboarding" });
}

async function handleAuthProfiles(req: Request) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;
  let pq = supabase.from("profiles").select("id, email, full_name, role").order("full_name");
  if (user.org_id) pq = pq.eq("org_id", user.org_id);
  else pq = pq.eq("id", user.id);
  const { data, error } = await pq;
  if (error) return json({ error: error.message }, 500);
  return json(data ?? []);
}

// ── In-app AI assistant (web UI: POST /ai/query) ──
// Answers questions about the org's tasks using OpenRouter. Key + model come from env OR
// public.app_settings ('openrouter_api_key' / 'openrouter_model') so they're SQL-settable.
async function openrouterKey(): Promise<string> {
  return Deno.env.get("OPENROUTER_API_KEY") || (await getAppSetting("openrouter_api_key"));
}
async function openrouterModel(): Promise<string> {
  return Deno.env.get("OPENROUTER_MODEL") || (await getAppSetting("openrouter_model")) || "poolside/laguna-xs-2.1:free";
}
function stripThinkTags(s: string): string { // some free models leak <think>…</think>
  let t = String(s || "");
  const i = t.lastIndexOf("</think>");
  if (i >= 0) t = t.slice(i + "</think>".length);
  return t.replace(/<\/?think>/gi, "").trim();
}
// The model returns ONE JSON object (maybe fenced / with leaked reasoning); extract it.
function aiExtractJson(s: string): any | null {
  let t = stripThinkTags(s || "");
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1];
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b < 0 || b < a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; }
}
function aiNormDate(s: any): string | null { // accept YYYY-MM-DD or DD-MM-YYYY
  if (s === null || s === undefined || s === "") return null;
  const str = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const m = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}
function aiPriority(p: any): string {
  const s = String(p || "").toLowerCase();
  if (s.startsWith("hi") || s === "urgent" || s === "h") return "high";
  if (s.startsWith("lo") || s === "l") return "low";
  return "medium";
}
function aiStatus(s: any, isMeeting: boolean): string | null {
  const x = String(s || "").toLowerCase().replace(/\s+/g, "_");
  if (x.startsWith("compl") || x === "done" || x === "finished") return "completed";
  if (isMeeting) {
    if (x.startsWith("sched") || x === "upcoming") return "scheduled";
    if (x.startsWith("cancel")) return "cancelled";
    return null;
  }
  if (x === "in_progress" || x === "inprogress" || x.startsWith("progress") || x === "doing" || x === "started") return "in_progress";
  if (x.startsWith("block")) return "blocked";
  if (x.startsWith("pend") || x === "todo" || x === "to_do" || x === "open") return "pending";
  return null;
}
function aiGenPassword(): string {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let s = ""; for (let i = 0; i < 10; i++) s += c[Math.floor(Math.random() * c.length)];
  return "Tf" + s + "!";
}
function aiFriendlyErr(r: { status: number; data: any }): string {
  if (r.status === 403) return "⚠️ You don't have permission to do that.";
  const m = r.data?.error || r.data?.detail;
  return "⚠️ " + (m || `Couldn't complete that (error ${r.status}).`);
}
// Run an internal API call as the SAME user (reuses each handler's auth + permission rules).
async function aiDispatch(userId: string, method: string, path: string, body: any): Promise<{ ok: boolean; status: number; data: any }> {
  const headers = new Headers({ "content-type": "application/json", "x-internal-secret": INTERNAL_SECRET, "x-internal-user": userId });
  const init: RequestInit = { method, headers };
  if (method !== "GET" && method !== "DELETE") init.body = JSON.stringify(body || {});
  const sub = new Request("https://internal" + path, init);
  let resp: Response | null | undefined = null;
  if (path.startsWith("/tasks")) resp = await handleTasks(sub, path);
  else if (path.startsWith("/meetings")) resp = await handleMeetings(sub, path);
  else if (path.startsWith("/projects")) resp = await handleProjects(sub, path);
  else if (path.startsWith("/admin")) resp = await handleAdmin(sub, path);
  if (!resp) return { ok: false, status: 404, data: { error: "Unsupported operation" } };
  let data: any = null; try { data = await resp.json(); } catch { /* */ }
  return { ok: resp.ok, status: resp.status, data };
}

// AI assistant + controller: natural language → answer OR one app operation.
// The model only emits a small JSON action; ALL execution + permissions happen here.
async function handleAIQuery(req: Request): Promise<Response> {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  let question = "";
  try { question = String((((await req.json()) as any) || {}).question || "").trim(); } catch { /* */ }
  if (!question) return json({ error: "Question is required" }, 400);
  return json({ answer: await runAiAssistant(auth.user, question) });
}

// Shared AI assistant + controller core — used by the web (/ai/query) AND the WhatsApp
// "TaskFlow-AI" mode. Returns a short human message (never JSON). Ops execute AS `user`
// (permissions enforced by the same handlers the dashboard uses).
async function runAiAssistant(user: AppUser & { email?: string }, question: string): Promise<string> {
  const key = await openrouterKey();
  const model = await openrouterModel();
  if (!key || !model) return "⚠️ The AI assistant isn't configured yet.";

  const org = user.org_id;
  const [membersRes, projectsRes, tasksRes, meetingsRes] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, role").eq("org_id", org),
    supabase.from("projects").select("id, name").eq("org_id", org),
    (() => { let q = supabase.from("tasks").select("id, title, status, priority, due_date, assignee_id, project_id").order("created_at", { ascending: false }).limit(60); if (org) q = q.eq("org_id", org); if (user.role !== "admin") q = q.eq("assignee_id", user.id); return q; })(),
    (() => { let q = supabase.from("meetings").select("id, title, status, priority, meeting_date, assignee_id, project_id").order("created_at", { ascending: false }).limit(40); if (org) q = q.eq("org_id", org); if (user.role !== "admin") q = q.eq("assignee_id", user.id); return q; })(),
  ]);
  const members = (membersRes.data || []) as any[];
  const projects = (projectsRes.data || []) as any[];
  const tasksCtx = (tasksRes.data || []) as any[];
  const meetingsCtx = (meetingsRes.data || []) as any[];
  const nameById = new Map(members.map((m) => [m.id, m.full_name || m.email]));
  const userName = nameById.get(user.id) || user.email || "the current user";
  const today = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10); // IST

  const nrm = (s: any) => String(s ?? "").trim().toLowerCase();
  const pick = (list: any[], qq: any, fields: string[]): { status: "ok"; item: any } | { status: "none" | "ambiguous" } => {
    const q = nrm(qq); if (!q) return { status: "none" };
    let c = list.filter((x) => fields.some((f) => nrm(x[f]) === q));
    if (c.length === 0) c = list.filter((x) => fields.some((f) => nrm(x[f]).includes(q)));
    if (c.length === 1) return { status: "ok", item: c[0] };
    return { status: c.length > 1 ? "ambiguous" : "none" };
  };
  const resolveAssignee = (name: any): { status: "ok"; id: string; label: string } | { status: "empty" | "none" | "ambiguous" } => {
    if (name === undefined || name === null || nrm(name) === "") return { status: "empty" };
    if (["me", "myself", "i", nrm(userName)].includes(nrm(name))) return { status: "ok", id: user.id, label: userName };
    const r = pick(members, name, ["full_name", "email"]);
    return r.status === "ok" ? { status: "ok", id: r.item.id, label: r.item.full_name || r.item.email } : { status: r.status };
  };
  const A = (msg: string) => msg;

  // Context for the model: names it can reference + current data for answering questions.
  const ctx = {
    today,
    me: userName,
    my_role: user.role,
    members: members.map((m) => ({ name: m.full_name || m.email, role: m.role })),
    projects: projects.map((p) => p.name),
    tasks: tasksCtx.map((t) => ({ title: t.title, status: t.status, priority: t.priority, due: t.due_date, assignee: nameById.get(t.assignee_id) || null })),
    meetings: meetingsCtx.map((m) => ({ title: m.title, status: m.status, date: m.meeting_date, assignee: nameById.get(m.assignee_id) || null })),
  };
  const systemPrompt = `You are TaskFlow's AI assistant AND controller. You either ANSWER a question or perform ONE operation.
Today is ${today}. Current user: "${userName}" (role: ${user.role}).
Output ONLY one complete, valid JSON object — nothing before or after it, no code fences, no reasoning, no <think>. Keep any "message"/"answer" under 300 characters.
Use names EXACTLY as they appear in the data. If a referenced person/task/meeting/project is not in the data, use op "clarify". If the user just greets or chats, use op "answer".
When asked to create something, ALWAYS emit the create op (duplicates are allowed) — never refuse because a similar item already exists.
Resolve relative dates to absolute YYYY-MM-DD using today. "me"/"myself"/"I" = the current user.

Ops:
{"op":"answer","message":"<answer using the data>"}
{"op":"clarify","message":"<what you need>"}
{"op":"create_task","title","assignee?","priority?":"low|medium|high","due_date?":"YYYY-MM-DD","project?","description?"}
{"op":"update_task","target":"<task title>","fields":{"title?","status?":"pending|in_progress|completed|blocked","priority?","due_date?","assignee?","project?","description?"}}
{"op":"delete_task","target":"<task title>"}
{"op":"create_meeting","title","assignee?","priority?","date?":"YYYY-MM-DD","project?","description?"}
{"op":"update_meeting","target":"<meeting title>","fields":{"title?","status?":"scheduled|completed|cancelled","priority?","date?","assignee?","project?","description?"}}
{"op":"delete_meeting","target":"<meeting title>"}
{"op":"create_project","name","description?"}
{"op":"create_user","fullName","email","password?","role?":"admin|employee","phone?"}
{"op":"update_user","target":"<member name>","fields":{"fullName?","phone?"}}
{"op":"set_password","target":"<member name>","password?"}
{"op":"delete_user","target":"<member name>"}`;

  const callModel = async (m: string, ms: number): Promise<string | null> => {
    const r = await fetchTimeout("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json", "HTTP-Referer": "https://taskflow.unimisk.com", "X-Title": "TaskFlow" },
      body: JSON.stringify({ model: m, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: `DATA:\n${JSON.stringify(ctx)}\n\nUser: ${question}` }], max_tokens: 700, temperature: 0 }),
    }, ms);
    if (!r || !r.ok) return null;
    try { return stripThinkTags((await r.json())?.choices?.[0]?.message?.content || ""); } catch { return null; }
  };
  const raw = (await callModel(model, 15000)) || (await callModel("nvidia/nemotron-3-ultra-550b-a55b:free", 7000));
  if (!raw) return "⚠️ The AI is busy right now. Please try again in a moment.";

  const act = aiExtractJson(raw);
  if (!act || !act.op) {
    // NEVER surface raw/garbled model output (e.g. truncated JSON). Salvage a human message
    // if one is present, otherwise ask the user to rephrase.
    const salv = raw.match(/"(?:message|answer|reply)"\s*:\s*"([^"]{1,600})/);
    if (salv) return A(salv[1].replace(/\\n/g, "\n").trim());
    if (/[{}\[\]<>]|"op"/.test(raw) || raw.length > 500) return A("🤔 I didn't quite catch that. Try rephrasing — e.g. *add a task to call Preet tomorrow, high priority*.");
    return A(raw.trim() || "🤔 I didn't catch that. Please try again.");
  }
  const op = String(act.op).toLowerCase();
  const f = act.fields || act;

  try {
    if (op === "answer" || op === "clarify") { const m = String(act.message || act.answer || "").trim(); return A(m || "🤔 I didn't catch that. Please rephrase."); }

    if (op === "create_task" || op === "create_meeting") {
      const isM = op === "create_meeting";
      const title = String(act.title || "").trim();
      if (!title) return A("⚠️ What should it be called?");
      const body: any = { title, description: act.description || null, priority: aiPriority(act.priority) };
      const date = aiNormDate(act.date ?? act.due_date ?? act.meeting_date);
      if (isM) body.meeting_date = date; else body.due_date = date;
      let projLabel = "";
      if (act.project && nrm(act.project) !== "none") {
        const pr = pick(projects, act.project, ["name"]);
        if (pr.status !== "ok") return A(`⚠️ I couldn't find a project called "${act.project}".`);
        body.project_id = pr.item.id; projLabel = pr.item.name;
      }
      const ra = resolveAssignee(act.assignee);
      let asg = "";
      if (ra.status === "ok") { body.assignee_ids = [ra.id]; asg = ra.label; }
      else if (ra.status === "ambiguous") return A(`⚠️ More than one person matches "${act.assignee}". Who exactly?`);
      else if (ra.status === "none") return A(`⚠️ I couldn't find "${act.assignee}" in your team.`);
      const r = await aiDispatch(user.id,"POST", isM ? "/meetings" : "/tasks", body);
      if (!r.ok) return A(aiFriendlyErr(r));
      return A(`✅ ${isM ? "Meeting" : "Task"} *${title}* created${asg ? ` and assigned to ${asg}` : ""}${date ? `, ${isM ? "on" : "due"} ${waFmtDate(date)}` : ""}, ${aiPriority(act.priority)} priority${projLabel ? `, project ${projLabel}` : ""}. It's on the dashboard now.`);
    }

    if (op === "update_task" || op === "update_meeting") {
      const isM = op === "update_meeting";
      const hit = pick(isM ? meetingsCtx : tasksCtx, act.target, ["title"]);
      if (hit.status === "ambiguous") return A(`⚠️ More than one ${isM ? "meeting" : "task"} matches "${act.target}". Be more specific?`);
      if (hit.status !== "ok") return A(`⚠️ I couldn't find a ${isM ? "meeting" : "task"} called "${act.target}".`);
      const id = hit.item.id;
      const body: any = {}; const changes: string[] = [];
      if (f.title) { body.title = String(f.title).trim(); changes.push(`title → ${body.title}`); }
      if (f.description !== undefined) { body.description = f.description; changes.push("description updated"); }
      if (f.priority) { body.priority = aiPriority(f.priority); changes.push(`priority → ${body.priority}`); }
      if (f.due_date !== undefined || f.date !== undefined || f.meeting_date !== undefined) {
        const d = aiNormDate(f.due_date ?? f.date ?? f.meeting_date);
        if (isM) body.meeting_date = d; else body.due_date = d;
        changes.push(`${isM ? "date" : "due"} → ${d ? waFmtDate(d) : "none"}`);
      }
      if (f.project !== undefined) {
        if (f.project === null || nrm(f.project) === "none") { body.project_id = null; changes.push("project → none"); }
        else { const pr = pick(projects, f.project, ["name"]); if (pr.status !== "ok") return A(`⚠️ I couldn't find a project called "${f.project}".`); body.project_id = pr.item.id; changes.push(`project → ${pr.item.name}`); }
      }
      if (f.assignee) { const ra = resolveAssignee(f.assignee); if (ra.status !== "ok") return A(`⚠️ I couldn't find "${f.assignee}" in your team.`); body.assignee_ids = [ra.id]; changes.push(`assignee → ${ra.label}`); }
      if (Object.keys(body).length) { const r = await aiDispatch(user.id,"PATCH", `/${isM ? "meetings" : "tasks"}/${id}`, body); if (!r.ok) return A(aiFriendlyErr(r)); }
      if (f.status) {
        const st = aiStatus(f.status, isM);
        if (!st) return A(`⚠️ "${f.status}" isn't a valid status.`);
        const r = await aiDispatch(user.id,"PATCH", `/${isM ? "meetings" : "tasks"}/${id}/status`, { status: st });
        if (!r.ok) return A(aiFriendlyErr(r));
        changes.push(`status → ${st}`);
      }
      if (!changes.length) return A(`⚠️ What would you like to change about "${hit.item.title}"?`);
      return A(`✅ Updated ${isM ? "meeting" : "task"} *${hit.item.title}* — ${changes.join(", ")}.`);
    }

    if (op === "delete_task" || op === "delete_meeting") {
      const isM = op === "delete_meeting";
      const hit = pick(isM ? meetingsCtx : tasksCtx, act.target, ["title"]);
      if (hit.status !== "ok") return A(`⚠️ I couldn't uniquely find a ${isM ? "meeting" : "task"} called "${act.target}".`);
      const r = await aiDispatch(user.id,"DELETE", `/${isM ? "meetings" : "tasks"}/${hit.item.id}`, {});
      if (!r.ok) return A(aiFriendlyErr(r));
      return A(`🗑️ Deleted ${isM ? "meeting" : "task"} *${hit.item.title}*.`);
    }

    if (op === "create_project") {
      const name = String(act.name || act.title || "").trim();
      if (!name) return A("⚠️ What should the project be called?");
      const r = await aiDispatch(user.id,"POST", "/projects", { name, description: act.description || null });
      if (!r.ok) return A(aiFriendlyErr(r));
      return A(`✅ Project *${name}* created.`);
    }

    if (op === "create_user") {
      const fullName = String(act.fullName || act.name || "").trim();
      const email = String(act.email || "").trim();
      if (!fullName) return A("⚠️ What's the new user's full name?");
      if (!email) return A(`⚠️ What email address should I use for ${fullName}?`);
      const role = nrm(act.role) === "admin" ? "admin" : "employee";
      const explicit = !!String(act.password || "").trim();
      const password = String(act.password || "").trim() || aiGenPassword();
      const r = await aiDispatch(user.id,"POST", "/admin/users", { email, password, fullName, role, phone: act.phone ? String(act.phone).trim() : "" });
      if (!r.ok) return A(aiFriendlyErr(r));
      return A(`✅ Created ${role} *${fullName}* (${email}).${explicit ? "" : `\nTemporary password: *${password}* — share it securely and have them change it.`}`);
    }

    if (op === "update_user") {
      const hit = pick(members, act.target || act.name, ["full_name", "email"]);
      if (hit.status !== "ok") return A(`⚠️ I couldn't find "${act.target || act.name}" in your team.`);
      const body: any = {}; const changes: string[] = [];
      if (f.fullName || f.full_name) { body.fullName = String(f.fullName || f.full_name).trim(); changes.push(`name → ${body.fullName}`); }
      if (f.phone !== undefined) { body.phone = f.phone ? String(f.phone).trim() : ""; changes.push(`phone → ${body.phone || "cleared"}`); }
      if (!changes.length) return A(`⚠️ What should I change for ${hit.item.full_name || hit.item.email}?`);
      const r = await aiDispatch(user.id,"PATCH", `/admin/users/${hit.item.id}`, body);
      if (!r.ok) return A(aiFriendlyErr(r));
      return A(`✅ Updated *${hit.item.full_name || hit.item.email}* — ${changes.join(", ")}.`);
    }

    if (op === "set_password") {
      const hit = pick(members, act.target || act.name, ["full_name", "email"]);
      if (hit.status !== "ok") return A(`⚠️ I couldn't find "${act.target || act.name}".`);
      const explicit = !!String(act.password || "").trim();
      const password = String(act.password || "").trim() || aiGenPassword();
      const r = await aiDispatch(user.id,"POST", `/admin/users/${hit.item.id}/password`, { password });
      if (!r.ok) return A(aiFriendlyErr(r));
      return A(`✅ Password updated for *${hit.item.full_name || hit.item.email}*.${explicit ? "" : `\nNew password: *${password}*`}`);
    }

    if (op === "delete_user") {
      const hit = pick(members, act.target || act.name, ["full_name", "email"]);
      if (hit.status !== "ok") return A(`⚠️ I couldn't find "${act.target || act.name}".`);
      const r = await aiDispatch(user.id,"DELETE", `/admin/users/${hit.item.id}`, {});
      if (!r.ok) return A(aiFriendlyErr(r));
      return A(`🗑️ Removed user *${hit.item.full_name || hit.item.email}*.`);
    }

    return A(String(act.message || act.answer || "🤔 I didn't catch that. Try, e.g., *add a task…* or *what's overdue?*")); // unknown op
  } catch (e) {
    console.error("[ai] op error:", (e as Error)?.message);
    return A("⚠️ Something went wrong while doing that. Please try again.");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Signup onboarding: WhatsApp 4-digit OTP + "create org" / "join org by 6-digit code".
// OTP is required at SIGNUP only — login never asks for it. Admin-created users
// (POST /admin/users) already have an org, so they skip all of this.
// ─────────────────────────────────────────────────────────────────────────────
function normPhoneDigits(input: unknown): string {
  let d = String(input ?? "").replace(/\D+/g, "");
  if (!d) return "";
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);  // trunk zero
  if (d.length === 10) d = OPENWA_DEFAULT_CC + d;            // bare local -> add country code
  return d;
}
function genOtpCode(): string { return String(Math.floor(1000 + Math.random() * 9000)); }

async function phoneTakenBy(e164: string, exceptProfileId?: string): Promise<boolean> {
  const { data } = await supabase.from("profiles").select("id").eq("phone", e164).maybeSingle();
  return !!data && data.id !== exceptProfileId;
}

async function handleOtpSend(req: Request) {
  const body = await parseBody(req) as any;
  const digits = normPhoneDigits(body.phone);
  if (digits.length < 11) return json({ error: "Enter a valid mobile number with country code." }, 400);
  const e164 = "+" + digits;
  if (await phoneTakenBy(e164)) return json({ error: "This mobile number is already registered." }, 409);

  const { data: prev } = await supabase.from("phone_otps").select("created_at").eq("phone", digits).maybeSingle();
  if (prev && Date.now() - new Date(prev.created_at).getTime() < 30_000) {
    return json({ error: "Please wait a few seconds before requesting another code." }, 429);
  }
  const code = genOtpCode();
  const { error } = await supabase.from("phone_otps").upsert({
    phone: digits, code, expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    attempts: 0, verified: false, created_at: new Date().toISOString(),
  }, { onConflict: "phone" });
  if (error) return json({ error: "Could not create a verification code. Please try again." }, 500);

  await openwaSendText(`${digits}@c.us`,
    `🔐 *TaskFlow verification*\n\nYour code is *${code}*\nIt expires in 10 minutes.\n\nIf you didn't request this, ignore this message.`);
  return json({ ok: true, sent_to: e164, expires_in: 600 });
}

async function handleOtpVerify(req: Request) {
  const body = await parseBody(req) as any;
  const digits = normPhoneDigits(body.phone);
  const code = String(body.code ?? "").trim();
  if (!digits || !/^\d{4}$/.test(code)) return json({ error: "Enter the 4-digit code." }, 400);

  const { data: row } = await supabase.from("phone_otps").select("*").eq("phone", digits).maybeSingle();
  if (!row) return json({ error: "Request a code first." }, 400);
  if (new Date(row.expires_at).getTime() < Date.now()) return json({ error: "That code expired. Request a new one." }, 400);
  if ((row.attempts ?? 0) >= 5) return json({ error: "Too many attempts. Request a new code." }, 429);
  if (String(row.code) !== code) {
    await supabase.from("phone_otps").update({ attempts: (row.attempts ?? 0) + 1 }).eq("phone", digits);
    return json({ error: "Incorrect code. Please try again." }, 400);
  }
  await supabase.from("phone_otps").update({ verified: true }).eq("phone", digits);
  return json({ ok: true, phone: "+" + digits });
}

// Public: confirm an org exists for a 6-digit code before the user commits to joining.
async function handleOrgLookup(req: Request) {
  const code = (new URL(req.url).searchParams.get("code") || "").replace(/\D+/g, "");
  if (code.length !== 6) return json({ error: "Enter the 6-digit organization code." }, 400);
  const { data: org } = await supabase.from("organizations").select("id, name").eq("org_uid", code).maybeSingle();
  if (!org) return json({ error: "No organization found with that code." }, 404);
  return json({ id: org.id, name: org.name });
}

async function handleOnboarding(req: Request) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;
  const body = await parseBody(req) as any;

  const { data: me } = await supabase.from("profiles").select("id, org_id, full_name, email").eq("id", user.id).maybeSingle();
  if (!me) return json({ error: "Profile not found." }, 404);
  if (me.org_id) return json({ error: "You already belong to an organization." }, 400);

  const digits = normPhoneDigits(body.phone);
  const e164 = "+" + digits;
  const { data: otp } = await supabase.from("phone_otps").select("verified").eq("phone", digits).maybeSingle();
  if (!otp?.verified) return json({ error: "Please verify your mobile number first." }, 400);
  if (await phoneTakenBy(e164, user.id)) return json({ error: "This mobile number is already registered." }, 409);

  const mode = String(body.mode ?? "").toLowerCase();

  if (mode === "create") {
    const orgName = String(body.orgName ?? "").trim();
    if (!orgName) return json({ error: "Organization name is required." }, 400);
    const { data: org, error: oErr } = await supabase.from("organizations")
      .insert([{ name: orgName }]).select("id, name, org_uid").single();   // org_uid auto-generated
    if (oErr || !org) return json({ error: oErr?.message || "Could not create organization." }, 400);
    const { error: pErr } = await supabase.from("profiles")
      .update({ phone: e164, phone_verified: true, role: "admin", org_id: org.id }).eq("id", user.id);
    if (pErr) return json({ error: pErr.message }, 400);
    await supabase.from("phone_otps").delete().eq("phone", digits);
    return json({ status: "active", role: "admin", org });
  }

  if (mode === "join") {
    const code = String(body.orgCode ?? "").replace(/\D+/g, "");
    if (code.length !== 6) return json({ error: "Enter the 6-digit organization code." }, 400);
    const { data: org } = await supabase.from("organizations").select("id, name").eq("org_uid", code).maybeSingle();
    if (!org) return json({ error: "No organization found with that code." }, 404);

    // Stay org-less until an admin approves.
    await supabase.from("profiles")
      .update({ phone: e164, phone_verified: true, role: "employee", org_id: null }).eq("id", user.id);
    const { error: jErr } = await supabase.from("org_join_requests").upsert({
      org_id: org.id, profile_id: user.id, status: "pending",
      created_at: new Date().toISOString(), decided_at: null, decided_by: null,
    }, { onConflict: "org_id,profile_id" });
    if (jErr) return json({ error: jErr.message }, 400);
    await supabase.from("phone_otps").delete().eq("phone", digits);

    scheduleNotify(async () => {
      const { data: admins } = await supabase.from("profiles")
        .select("phone").eq("org_id", org.id).eq("role", "admin").not("phone", "is", null);
      for (const a of (admins || []) as any[]) {
        const chat = openwaChatId(a.phone);
        if (chat) {
          await openwaSendText(chat,
            `👤 *New join request*\n\n${me.full_name || me.email} wants to join *${org.name}*.\n\nApprove or reject it in TaskFlow → Users → Join requests.`);
        }
      }
    });
    return json({ status: "pending_approval", org: { id: org.id, name: org.name } });
  }

  return json({ error: "Choose to create a new organization or join an existing one." }, 400);
}

async function assertTaskAccess(user: AppUser, taskId: string): Promise<Response | null> {
  if (user.role === "admin") {
    let aq = supabase.from("tasks").select("id").eq("id", taskId);
    if (user.org_id) aq = aq.eq("org_id", user.org_id);
    const { data } = await aq.maybeSingle();
    if (!data) return json({ error: "Task not found" }, 404);
    return null;
  }
  let tq = supabase.from("tasks").select("id, assignee_id").eq("id", taskId);
  if (user.org_id) tq = tq.eq("org_id", user.org_id);
  const { data: row } = await tq.maybeSingle();
  if (!row) return json({ error: "Task not found or access denied" }, 404);
  const { data: inj } = await supabase.from("task_assignees").select("task_id").eq("task_id", taskId).eq("profile_id", user.id).maybeSingle();
  if (row.assignee_id !== user.id && !inj) return json({ error: "Task not found or access denied" }, 403);
  return null;
}

async function assertMeetingAccess(user: AppUser, meetingId: string): Promise<Response | null> {
  const meeting = await fetchMeetingWithAssignees(meetingId, user.org_id);
  if (!meeting) return json({ error: "Meeting not found or access denied" }, 404);
  if (!meetingCanBeAccessedBy(user, meeting)) return json({ error: "Access denied" }, 403);
  return null;
}

/** Mirrors backend `employeeSeesMappedRow` for shaped task/meeting rows. */
function employeeSeesShapedAssigneeRow(
  userId: string,
  row: { assignee_id?: string | null; assignee_ids?: string[] },
): boolean {
  if (!row || !userId) return false;
  if (row.assignee_id === userId) return true;
  const ids = row.assignee_ids || [];
  return ids.includes(userId);
}

async function validateParentTaskEdge(user: AppUser, parentTaskId: string | null | undefined): Promise<Response | null> {
  if (!parentTaskId) return null;
  let pq = supabase.from("tasks").select("id, org_id, assignee_id").eq("id", parentTaskId);
  if (user.org_id) pq = pq.eq("org_id", user.org_id);
  const { data: parent } = await pq.maybeSingle();
  if (!parent) return json({ error: "Invalid parent task" }, 400);
  if (user.role === "admin") return null;
  const { data: inj } = await supabase.from("task_assignees").select("task_id").eq("task_id", parentTaskId).eq(
    "profile_id",
    user.id,
  ).maybeSingle();
  if (parent.assignee_id !== user.id && !inj) {
    return json({ error: "You can only add subtasks to tasks you are assigned to" }, 403);
  }
  return null;
}

async function validateParentMeetingEdge(
  user: AppUser,
  parentMeetingId: string | null | undefined,
): Promise<Response | null> {
  if (!parentMeetingId) return null;
  const parentRow = await fetchMeetingWithAssignees(parentMeetingId, user.org_id);
  if (!parentRow) return json({ error: "Invalid parent meeting" }, 400);
  if (user.org_id && parentRow.org_id !== user.org_id) return json({ error: "Invalid parent meeting" }, 400);
  if (user.role === "admin") return null;
  if (!meetingCanBeAccessedBy(user, parentRow)) {
    return json({ error: "You can only add sub-meetings to meetings you are assigned to" }, 403);
  }
  return null;
}

async function fetchSubtasksForDetail(
  parentId: string,
  user: AppUser,
): Promise<
  { id: string; title: string; status: string; due_date: unknown; priority: unknown; parent_task_id: string | null }[]
> {
  let q = supabase.from("tasks").select("*").eq("parent_task_id", parentId);
  if (user.org_id) q = q.eq("org_id", user.org_id);
  const { data: rows } = await q.order("created_at", { ascending: true });
  if (!rows?.length) return [];
  const shaped = await shapeTasksWithJoins(rows);
  let filtered = shaped;
  if (user.role === "admin") {
    let roleById: Record<string, string> = {};
    if (user.org_id) {
      try {
        roleById = await loadOrgRoleByIdForEdge(user.org_id);
      } catch {
        roleById = {};
      }
    }
    filtered = shaped.filter((t) => edgeAdminSeesItem(t, user.id, roleById, "task"));
  } else {
    filtered = shaped.filter((t) => employeeSeesShapedAssigneeRow(user.id, t));
  }
  return filtered.map(({ id: sid, title, status, due_date, priority, parent_task_id }) => ({
    id: sid,
    title,
    status,
    due_date,
    priority,
    parent_task_id: parent_task_id ?? null,
  }));
}

async function fetchSubmeetingsForDetail(
  parentId: string,
  user: AppUser,
): Promise<
  {
    id: string;
    title: string;
    status: string;
    meeting_date: unknown;
    meeting_time: unknown;
    priority: unknown;
    parent_meeting_id: string | null;
  }[]
> {
  let q = supabase.from("meetings").select("*").eq("parent_meeting_id", parentId);
  if (user.org_id) q = q.eq("org_id", user.org_id);
  const { data: rows } = await q.order("created_at", { ascending: true });
  if (!rows?.length) return [];
  const shaped = await shapeMeetingsWithJoins(rows);
  let filtered = shaped;
  if (user.role === "admin") {
    let roleById: Record<string, string> = {};
    if (user.org_id) {
      try {
        roleById = await loadOrgRoleByIdForEdge(user.org_id);
      } catch {
        roleById = {};
      }
    }
    filtered = shaped.filter((m) => edgeAdminSeesItem(m, user.id, roleById, "meeting"));
  } else {
    filtered = shaped.filter((m) => employeeSeesShapedAssigneeRow(user.id, m));
  }
  return filtered.map(({ id: sid, title, status, meeting_date, meeting_time, priority, parent_meeting_id }) => ({
    id: sid,
    title,
    status,
    meeting_date,
    meeting_time,
    priority,
    parent_meeting_id: parent_meeting_id ?? null,
  }));
}

async function handleTasks(req: Request, path: string) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  if (req.method === "GET" && path === "/tasks") {
    if (user.role === "admin") {
      let aq = supabase.from("tasks").select("*");
      if (user.org_id) aq = aq.eq("org_id", user.org_id);
      const { data, error } = await aq;
      if (error) return json({ error: error.message }, 400);
      return json(await shapeTasksWithJoins(sortByCreatedAtDesc(data ?? [])));
    }
    const { data: ra } = await supabase.from("task_assignees").select("task_id").eq("profile_id", user.id);
    const fromJ = [...new Set((ra ?? []).map((r: { task_id: string }) => r.task_id))];
    let legQ = supabase.from("tasks").select("id").eq("assignee_id", user.id);
    if (user.org_id) legQ = legQ.eq("org_id", user.org_id);
    const { data: leg } = await legQ;
    const fromLeg = (leg ?? []).map((r: { id: string }) => r.id);
    const allIds = [...new Set([...fromJ, ...fromLeg])];
    if (!allIds.length) return json([]);
    const { rows, error: chunkErr } = await fetchTasksByIdsChunked(allIds);
    if (chunkErr) return json({ error: chunkErr.message }, 400);
    return json(await shapeTasksWithJoins(rows));
  }

  const getOneTask = path.match(/^\/tasks\/([^/]+)$/);
  if (req.method === "GET" && getOneTask) {
    const id = getOneTask[1];
    const deny = await assertTaskAccess(user, id);
    if (deny) return deny;
    const { data, error } = await supabase.from("tasks").select("*").eq("id", id).single();
    if (error) return json({ error: error.message }, 400);
    const shaped = await shapeTasksWithJoins([data]);
    const base = shaped[0];
    const subtasks = await fetchSubtasksForDetail(id, user);
    return json({ ...base, subtasks });
  }

  if (req.method === "POST" && path === "/tasks") {
    if (!user.org_id) {
      return json({ error: "Your profile has no organization; cannot create tasks." }, 400);
    }
    const body = await parseBody(req);
    const parent_task_id =
      (body as any).parent_task_id ?? (body as any).parentTaskId ?? null;
    // Anyone in the org may create a top-level task; subtasks still require
    // the parent's assignee check so an employee can't graft a child onto
    // a task they have no access to.
    if (parent_task_id) {
      const pErr = await validateParentTaskEdge(user, String(parent_task_id));
      if (pErr) return pErr;
    }
    const { title, description, priority, due_date, due_time, project_id } = body as any;
    const assignee_ids = normalizeAssigneeIds(body);
    if (!title?.trim()) return json({ error: "Title is required" }, 400);
    if (project_id) {
      const { data: proj } = await supabase.from("projects").select("id").eq("id", project_id).eq("org_id", user.org_id).maybeSingle();
      if (!proj) return json({ error: "Project not found" }, 400);
    }
    const primary = assignee_ids[0] ?? null;
    const { data: task, error } = await supabase
      .from("tasks")
      .insert([{
        title: title.trim(),
        description,
        assignee_id: primary,
        project_id: project_id || null,
        priority: priority || "medium",
        due_date: due_date || null,
        due_time: due_time || null,
        status: "pending",
        created_by: user.id,
        org_id: user.org_id,
        parent_task_id: parent_task_id || null,
      }])
      .select("id")
      .single();
    if (error) return json({ error: error.message }, 400);
    if (assignee_ids.length && task?.id) {
      const { error: aErr } = await supabase.from("task_assignees").insert(
        assignee_ids.map((profile_id) => ({ task_id: task.id, profile_id })),
      );
      if (aErr) {
        await supabase.from("tasks").delete().eq("id", task.id);
        return json({ error: aErr.message }, 400);
      }
    }
    const { data: full, error: fErr } = await supabase.from("tasks").select("*").eq("id", task!.id).single();
    if (fErr) return json({ error: fErr.message }, 400);
    const shaped = await shapeTasksWithJoins([full]);
    const out = shaped[0];
    scheduleAudit(() =>
      logTaskHistory(out.id, user.id, user.org_id, "created", {
        title: out.title,
        priority: out.priority,
        due_date: out.due_date ?? null,
        due_time: out.due_time ?? null,
        project_id: out.project_id ?? null,
        assignee_ids: out.assignee_ids ?? [],
        parent_task_id: out.parent_task_id ?? null,
      }, null)
    );
    scheduleNotify(async () => {
      const who = await getActorDisplayName(supabase, user.id);
      await notifyUsersEdge(supabase, {
        userIds: out.assignee_ids || [],
        excludeUserId: user.id,
        category: "task_assigned",
        title: "New task assigned",
        body: `${who} assigned you: ${out.title}`,
        data: { type: "task", taskId: String(out.id), url: "/" },
      });
      await whatsappNotifyAssignees("task", out, who, user.id);
    });
    return json(out, 201);
  }

  // POST /tasks/import — admin-only bulk CSV import.
  //   body: { filename?: string, rows: Array<Record<string, string>> }
  // Each row is one parsed CSV record (column header → cell). Returns a
  // per-row report so the UI can show "5 created, 2 skipped because …".
  if (req.method === "POST" && path === "/tasks/import") {
    const adminErr = requireAdmin(user);
    if (adminErr) return adminErr;
    if (!user.org_id) return json({ error: "Your profile has no organization." }, 400);

    const body = (await parseBody(req)) as { filename?: string; rows?: Record<string, string>[] };
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!rows.length) return json({ error: "No rows in payload." }, 400);
    if (rows.length > 1000) return json({ error: "Too many rows (limit 1000 per import)." }, 400);

    const created: { id: string; title: string; row: number }[] = [];
    const skipped: { row: number; reason: string; title?: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2; // human-readable: header is row 1
      const c = canonicalize(rows[i] || {}, "task");

      if (!c.title) {
        skipped.push({ row: rowNum, reason: "Missing title" });
        continue;
      }
      const due_date = c.due_date ? parseFlexDate(c.due_date) : "";
      if (c.due_date && !due_date) {
        skipped.push({ row: rowNum, title: c.title, reason: `Unrecognised due_date: "${c.due_date}"` });
        continue;
      }
      const due_time = c.due_time ? parseFlexTime(c.due_time) : "";
      if (c.due_time && !due_time) {
        skipped.push({ row: rowNum, title: c.title, reason: `Unrecognised due_time: "${c.due_time}"` });
        continue;
      }

      const assigneesRes = await resolveAssignees(user.org_id, c.assignees);
      if (!assigneesRes.ids.length) {
        skipped.push({ row: rowNum, title: c.title, reason: assigneesRes.unresolved.length
          ? `No matching assignee for: ${assigneesRes.unresolved.join(", ")}`
          : "At least one assignee is required" });
        continue;
      }

      const project_id = c.project ? await resolveProject(user.org_id, c.project) : null;
      if (c.project && !project_id) {
        skipped.push({ row: rowNum, title: c.title, reason: `Project "${c.project}" not found in this workspace` });
        continue;
      }

      const priority = parsePriority(c.priority);
      const primary = assigneesRes.ids[0];

      const { data: task, error } = await supabase
        .from("tasks")
        .insert([{
          title: c.title,
          description: c.description || null,
          assignee_id: primary,
          project_id,
          priority,
          due_date: due_date || null,
          due_time: due_time || null,
          status: "pending",
          created_by: user.id,
          org_id: user.org_id,
        }])
        .select("id")
        .single();

      if (error || !task) {
        skipped.push({ row: rowNum, title: c.title, reason: error?.message || "Insert failed" });
        continue;
      }

      if (assigneesRes.ids.length > 0) {
        const { error: aErr } = await supabase.from("task_assignees").insert(
          assigneesRes.ids.map((profile_id) => ({ task_id: task.id, profile_id })),
        );
        if (aErr) {
          await supabase.from("tasks").delete().eq("id", task.id);
          skipped.push({ row: rowNum, title: c.title, reason: `Assignee link failed: ${aErr.message}` });
          continue;
        }
      }

      created.push({ id: task.id, title: c.title, row: rowNum });
      scheduleAudit(() =>
        logTaskHistory(task.id, user.id, user.org_id, "created", {
          via: "csv_import",
          title: c.title,
          priority,
          due_date: due_date || null,
          due_time: due_time || null,
          project_id,
          assignee_ids: assigneesRes.ids,
        }, null)
      );
    }

    // Persist audit row (best-effort).
    try {
      await supabase.from("import_logs").insert([{
        org_id: user.org_id,
        actor_id: user.id,
        kind: "task",
        filename: body.filename || null,
        total_rows: rows.length,
        created_count: created.length,
        skipped_count: skipped.length,
        errors: skipped,
        created_ids: created.map((c) => c.id),
      }]);
    } catch (e) {
      console.warn("[import_logs] insert failed:", (e as Error)?.message);
    }

    return json({
      total: rows.length,
      created: created.length,
      skipped: skipped.length,
      errors: skipped,
      created_items: created,
    });
  }

  const statusMatch = path.match(/^\/tasks\/([^/]+)\/status$/);
  if (req.method === "PATCH" && statusMatch) {
    const id = statusMatch[1];
    const body = await parseBody(req);
    const status = (body as any).status;
    if (!status) return json({ error: "Status is required" }, 400);
    if (user.role !== "admin") {
      let rq = supabase.from("tasks").select("id, assignee_id").eq("id", id);
      if (user.org_id) rq = rq.eq("org_id", user.org_id);
      const { data: row } = await rq.maybeSingle();
      if (!row) return json({ error: "Task not found or access denied" }, 404);
      const { data: inj } = await supabase.from("task_assignees").select("task_id").eq("task_id", id).eq("profile_id", user.id).maybeSingle();
      if (row.assignee_id !== user.id && !inj) return json({ error: "Task not found or access denied" }, 403);
    }
    const { data: beforeRow } = await supabase.from("tasks").select("status").eq("id", id).maybeSingle();
    let uq = supabase
      .from("tasks")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (user.org_id) uq = uq.eq("org_id", user.org_id);
    const { data, error } = await uq
      .select("*")
      .maybeSingle();
    if (error) return json({ error: error.message }, 400);
    if (!data) return json({ error: "Task not found or access denied" }, 404);
    const shaped = await shapeTasksWithJoins([data]);
    const out = shaped[0];
    const prevStatus = (beforeRow as { status?: string } | null)?.status ?? null;
    if (prevStatus !== status) {
      scheduleAudit(() =>
        logTaskHistory(id, user.id, user.org_id, "status_changed", { status: { from: prevStatus, to: status } }, null)
      );
    }
    scheduleNotify(async () => {
      const who = await getActorDisplayName(supabase, user.id);
      await notifyUsersEdge(supabase, {
        userIds: out.assignee_ids || [],
        excludeUserId: user.id,
        category: "task_update",
        title: "Task status updated",
        body: `${who} set "${out.title}" to ${status}`,
        data: { type: "task", taskId: id, url: "/" },
      });
    });
    return json(out);
  }

  const patchTaskDetail = path.match(/^\/tasks\/([^/]+)$/);
  if (req.method === "PATCH" && patchTaskDetail) {
    const id = patchTaskDetail[1];
    const adminErr = requireAdmin(user);
    if (adminErr) return adminErr;
    const deny = await assertTaskAccess(user, id);
    if (deny) return deny;
    const body = await parseBody(req) as Record<string, unknown>;
    const {
      title,
      description,
      priority,
      due_date,
      due_time,
      project_id,
    } = body as any;
    const parent_task_id_in = (body as any).parent_task_id ?? (body as any).parentTaskId;
    if (title !== undefined && !String(title).trim()) return json({ error: "Title cannot be empty" }, 400);
    if (project_id) {
      const { data: proj } = await supabase.from("projects").select("id").eq("id", project_id).eq("org_id", user.org_id).maybeSingle();
      if (!proj) return json({ error: "Project not found" }, 400);
    }
    if (parent_task_id_in !== undefined) {
      const nextParent = parent_task_id_in === null || parent_task_id_in === ""
        ? null
        : String(parent_task_id_in);
      if (nextParent !== null) {
        const pErr = await validateParentTaskEdge(user, nextParent);
        if (pErr) return pErr;
        if (nextParent === id) return json({ error: "Task cannot be its own parent" }, 400);
      }
    }
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (title !== undefined) patch.title = String(title).trim();
    if (description !== undefined) patch.description = description;
    if (priority !== undefined) patch.priority = priority;
    if (due_date !== undefined) patch.due_date = due_date || null;
    if (due_time !== undefined) patch.due_time = due_time || null;
    if (project_id !== undefined) patch.project_id = project_id || null;
    if (parent_task_id_in !== undefined) {
      patch.parent_task_id = parent_task_id_in === null || parent_task_id_in === ""
        ? null
        : String(parent_task_id_in);
    }

    const assignee_ids = body.assignee_ids !== undefined || body.assigneeIds !== undefined
      ? normalizeAssigneeIds(body)
      : null;

    let previousAssigneeIds: string[] = [];
    if (assignee_ids !== null) {
      const { data: oldLinks } = await supabase.from("task_assignees").select("profile_id").eq("task_id", id);
      previousAssigneeIds = [...new Set((oldLinks ?? []).map((r: { profile_id: string }) => r.profile_id))];
    }

    const { data: before } = await supabase.from("tasks").select("*").eq("id", id).single();
    if (!before) return json({ error: "Task not found" }, 404);

    let patchQ = supabase.from("tasks").update(patch).eq("id", id);
    if (user.org_id) patchQ = patchQ.eq("org_id", user.org_id);
    const { error: upErr } = await patchQ;
    if (upErr) return json({ error: upErr.message }, 400);

    if (assignee_ids !== null) {
      await supabase.from("task_assignees").delete().eq("task_id", id);
      const primary = assignee_ids[0] ?? null;
      let primQ = supabase.from("tasks").update({ assignee_id: primary }).eq("id", id);
      if (user.org_id) primQ = primQ.eq("org_id", user.org_id);
      await primQ;
      if (assignee_ids.length) {
        const { error: aErr } = await supabase.from("task_assignees").insert(
          assignee_ids.map((profile_id) => ({ task_id: id, profile_id })),
        );
        if (aErr) return json({ error: aErr.message }, 400);
      }
    }

    const { data: full, error: fErr } = await supabase.from("tasks").select("*").eq("id", id).single();
    if (fErr) return json({ error: fErr.message }, 400);
    const shaped = await shapeTasksWithJoins([full]);
    const out = shaped[0];
    const fieldChanges = diffForHistory(before as Record<string, unknown>, patch);
    let assigneeDiff: { added: string[]; removed: string[] } | null = null;
    if (assignee_ids !== null) {
      const oldSet = new Set(previousAssigneeIds);
      const newSet = new Set(out.assignee_ids || []);
      const added = (out.assignee_ids || []).filter((uid: string) => !oldSet.has(uid));
      const removed = previousAssigneeIds.filter((uid) => !newSet.has(uid));
      if (added.length || removed.length) {
        assigneeDiff = { added, removed };
      }
      if (added.length) {
        scheduleNotify(async () => {
          const who = await getActorDisplayName(supabase, user.id);
          await notifyUsersEdge(supabase, {
            userIds: added,
            excludeUserId: user.id,
            category: "task_assigned",
            title: "Task assignment updated",
            body: `${who} added you to: ${out.title}`,
            data: { type: "task", taskId: id, url: "/" },
          });
        });
      }
    }
    const hasFieldChanges = Object.keys(fieldChanges).length > 0;
    if (hasFieldChanges || assigneeDiff) {
      const changes: HistoryChanges = { ...fieldChanges };
      if (assigneeDiff) changes.assignees = assigneeDiff;
      scheduleAudit(() => logTaskHistory(id, user.id, user.org_id, "updated", changes, null));
    }
    return json(out);
  }

  // GET /tasks/:id/history — list audit log entries for a task
  const historyMatchT = path.match(/^\/tasks\/([^/]+)\/history$/);
  if (req.method === "GET" && historyMatchT) {
    const id = historyMatchT[1];
    const deny = await assertTaskAccess(user, id);
    if (deny) return deny;
    const { data, error } = await supabase
      .from("task_history")
      .select("id, task_id, actor_id, action, changes, note, created_at")
      .eq("task_id", id)
      .order("created_at", { ascending: true });
    if (error) return json({ error: error.message }, 400);
    return json(data ?? []);
  }

  // POST /tasks/:id/submit — employee (or admin) submits work for review.
  const submitMatchT = path.match(/^\/tasks\/([^/]+)\/submit$/);
  if (req.method === "POST" && submitMatchT) {
    const id = submitMatchT[1];
    const deny = await assertTaskAccess(user, id);
    if (deny) return deny;
    const body = await parseBody(req) as Record<string, unknown>;
    const note = typeof body.note === "string" ? String(body.note).trim() : "";
    let uq = supabase
      .from("tasks")
      .update({
        status: "submitted",
        submission_notes: note || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (user.org_id) uq = uq.eq("org_id", user.org_id);
    const { data, error } = await uq.select("*").maybeSingle();
    if (error) return json({ error: error.message }, 400);
    if (!data) return json({ error: "Task not found or access denied" }, 404);
    const shaped = await shapeTasksWithJoins([data]);
    const out = shaped[0];
    scheduleAudit(() =>
      logTaskHistory(id, user.id, user.org_id, "submitted", { status: { from: null, to: "submitted" } }, note || null)
    );
    scheduleNotify(async () => {
      const who = await getActorDisplayName(supabase, user.id);
      await notifyUsersEdge(supabase, {
        userIds: out.assignee_ids || [],
        excludeUserId: user.id,
        category: "task_update",
        title: "Task submitted for review",
        body: `${who} submitted: ${out.title}`,
        data: { type: "task", taskId: id, url: "/" },
      });
    });
    return json(out);
  }

  // POST /tasks/:id/approve — admin approves the submission → completed.
  const approveMatchT = path.match(/^\/tasks\/([^/]+)\/approve$/);
  if (req.method === "POST" && approveMatchT) {
    const adminErr = requireAdmin(user);
    if (adminErr) return adminErr;
    const id = approveMatchT[1];
    const deny = await assertTaskAccess(user, id);
    if (deny) return deny;
    const body = await parseBody(req) as Record<string, unknown>;
    const note = typeof body.note === "string" ? String(body.note).trim() : "";
    let uq = supabase
      .from("tasks")
      .update({
        status: "completed",
        approval_notes: note || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (user.org_id) uq = uq.eq("org_id", user.org_id);
    const { data, error } = await uq.select("*").maybeSingle();
    if (error) return json({ error: error.message }, 400);
    if (!data) return json({ error: "Task not found" }, 404);
    const shaped = await shapeTasksWithJoins([data]);
    const out = shaped[0];
    scheduleAudit(() =>
      logTaskHistory(id, user.id, user.org_id, "approved", { status: { from: null, to: "completed" } }, note || null)
    );
    scheduleNotify(async () => {
      const who = await getActorDisplayName(supabase, user.id);
      await notifyUsersEdge(supabase, {
        userIds: out.assignee_ids || [],
        excludeUserId: user.id,
        category: "task_update",
        title: "Task approved",
        body: `${who} approved: ${out.title}`,
        data: { type: "task", taskId: id, url: "/" },
      });
    });
    return json(out);
  }

  // POST /tasks/:id/request-changes — admin sends task back for rework.
  const requestChangesMatchT = path.match(/^\/tasks\/([^/]+)\/request-changes$/);
  if (req.method === "POST" && requestChangesMatchT) {
    const adminErr = requireAdmin(user);
    if (adminErr) return adminErr;
    const id = requestChangesMatchT[1];
    const deny = await assertTaskAccess(user, id);
    if (deny) return deny;
    const body = await parseBody(req) as Record<string, unknown>;
    const note = typeof body.note === "string" ? String(body.note).trim() : "";
    if (!note) return json({ error: "Please describe the changes requested" }, 400);
    let uq = supabase
      .from("tasks")
      .update({
        status: "changes_requested",
        approval_notes: note,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (user.org_id) uq = uq.eq("org_id", user.org_id);
    const { data, error } = await uq.select("*").maybeSingle();
    if (error) return json({ error: error.message }, 400);
    if (!data) return json({ error: "Task not found" }, 404);
    const shaped = await shapeTasksWithJoins([data]);
    const out = shaped[0];
    scheduleAudit(() =>
      logTaskHistory(id, user.id, user.org_id, "changes_requested", { status: { from: null, to: "changes_requested" } }, note)
    );
    scheduleNotify(async () => {
      const who = await getActorDisplayName(supabase, user.id);
      await notifyUsersEdge(supabase, {
        userIds: out.assignee_ids || [],
        excludeUserId: user.id,
        category: "task_update",
        title: "Changes requested",
        body: `${who} requested changes on: ${out.title}`,
        data: { type: "task", taskId: id, url: "/" },
      });
    });
    return json(out);
  }

  // ── Task attachments (audio / document / other) ──────────────────────
  const taskAttMatch = path.match(/^\/tasks\/([^/]+)\/attachments$/);
  if (req.method === "GET" && taskAttMatch) {
    const id = taskAttMatch[1];
    const deny = await assertTaskAccess(user, id);
    if (deny) return deny;
    const { data, error } = await supabase
      .from("task_attachments")
      .select("id, type, original_name, content_type, size_bytes, created_at")
      .eq("task_id", id)
      .order("created_at", { ascending: false });
    if (error) return json({ error: error.message }, 400);
    return json(data ?? []);
  }

  // Upload — anyone with access to the task (admin or assignee) may attach.
  if (req.method === "POST" && taskAttMatch) {
    const id = taskAttMatch[1];
    const deny = await assertTaskAccess(user, id);
    if (deny) return deny;
    if (!user.org_id) return json({ error: "Your profile has no organization; cannot upload files." }, 400);

    const form = await req.formData();
    const type = String(form.get("type") || "other");
    const file = form.get("file");
    if (!(file instanceof File)) return json({ error: "File is required" }, 400);

    const safeName = file.name.replace(/[^\w.\-() ]+/g, "_");
    const pathKey = `${user.org_id}/${id}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
    const fileBuf = new Uint8Array(await file.arrayBuffer());

    const { error: upErr } = await supabase.storage
      .from("task-assets")
      .upload(pathKey, fileBuf, { contentType: file.type || "application/octet-stream", upsert: false });
    if (upErr) return json({ error: upErr.message }, 400);

    const { data: row, error: insErr } = await supabase
      .from("task_attachments")
      .insert([{
        org_id: user.org_id,
        task_id: id,
        assignee_id: user.id,
        type,
        bucket: "task-assets",
        path: pathKey,
        original_name: file.name,
        content_type: file.type,
        size_bytes: file.size,
        created_by: user.id,
      }])
      .select("id, type, original_name, content_type, size_bytes, created_at")
      .single();
    if (insErr) return json({ error: insErr.message }, 400);
    return json(row, 201);
  }

  const taskDownMatch = path.match(/^\/tasks\/attachments\/([^/]+)\/download$/);
  if (req.method === "GET" && taskDownMatch) {
    const attId = taskDownMatch[1];
    const { data: att, error } = await supabase
      .from("task_attachments")
      .select("id, task_id, org_id, bucket, path")
      .eq("id", attId)
      .maybeSingle();
    if (error) return json({ error: error.message }, 400);
    if (!att) return json({ error: "Attachment not found" }, 404);
    const deny = await assertTaskAccess(user, att.task_id);
    if (deny) return deny;
    const { data: signed, error: sErr } = await supabase.storage.from(att.bucket).createSignedUrl(att.path, 600);
    if (sErr) return json({ error: sErr.message }, 400);
    return Response.redirect(signed.signedUrl, 302);
  }

  const delMatch = path.match(/^\/tasks\/([^/]+)$/);
  if (req.method === "DELETE" && delMatch) {
    const adminErr = requireAdmin(user);
    if (adminErr) return adminErr;
    const id = delMatch[1];
    let delQ = supabase.from("tasks").delete().eq("id", id);
    if (user.org_id) delQ = delQ.eq("org_id", user.org_id);
    const { error } = await delQ;
    if (error) return json({ error: error.message }, 400);
    return json({ message: "Deleted" });
  }

  return null;
}

async function handleMeetings(req: Request, path: string) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  if (req.method === "GET" && path === "/meetings") {
    if (user.role === "admin") {
      let aq = supabase.from("meetings").select("*");
      if (user.org_id) aq = aq.eq("org_id", user.org_id);
      const { data, error } = await aq;
      if (error) return json({ error: error.message }, 400);
      return json(await shapeMeetingsWithJoins(sortByCreatedAtDesc(data ?? [])));
    }
    const { data: ra } = await supabase.from("meeting_assignees").select("meeting_id").eq("profile_id", user.id);
    const fromJ = [...new Set((ra ?? []).map((r: { meeting_id: string }) => r.meeting_id))];
    let legMq = supabase.from("meetings").select("id").eq("assignee_id", user.id);
    if (user.org_id) legMq = legMq.eq("org_id", user.org_id);
    const { data: leg } = await legMq;
    const fromLeg = (leg ?? []).map((r: { id: string }) => r.id);
    const allIds = [...new Set([...fromJ, ...fromLeg])];
    if (!allIds.length) return json([]);
    const { rows, error: chunkErr } = await fetchMeetingsByIdsChunked(allIds);
    if (chunkErr) return json({ error: chunkErr.message }, 400);
    return json(await shapeMeetingsWithJoins(rows));
  }

  const getOneMeeting = path.match(/^\/meetings\/([^/]+)$/);
  if (req.method === "GET" && getOneMeeting) {
    const id = getOneMeeting[1];
    const deny = await assertMeetingAccess(user, id);
    if (deny) return deny;
    const { data, error } = await supabase.from("meetings").select("*").eq("id", id).single();
    if (error) return json({ error: error.message }, 400);
    const shaped = await shapeMeetingsWithJoins([data]);
    const base = shaped[0];
    const submeetings = await fetchSubmeetingsForDetail(id, user);
    return json({ ...base, submeetings });
  }

  if (req.method === "POST" && path === "/meetings") {
    if (!user.org_id) {
      return json({ error: "Your profile has no organization; cannot create meetings." }, 400);
    }
    const body = await parseBody(req);
    const parent_meeting_id =
      (body as any).parent_meeting_id ?? (body as any).parentMeetingId ?? null;
    // Anyone in the org may create a top-level meeting. Sub-meetings still
    // need to validate the parent so an employee can't nest under a meeting
    // they aren't part of.
    if (parent_meeting_id) {
      const pErr = await validateParentMeetingEdge(user, String(parent_meeting_id));
      if (pErr) return pErr;
    }
    const { title, description, priority, meeting_date, meeting_time, project_id } = body as any;
    const assignee_ids = normalizeAssigneeIds(body);
    if (!title?.trim()) return json({ error: "Title is required" }, 400);
    if (project_id) {
      const { data: proj } = await supabase.from("projects").select("id").eq("id", project_id).eq("org_id", user.org_id).maybeSingle();
      if (!proj) return json({ error: "Project not found" }, 400);
    }
    const primary = assignee_ids[0] ?? null;
    const { data: meeting, error } = await supabase
      .from("meetings")
      .insert([{
        title: title.trim(),
        description,
        assignee_id: primary,
        project_id: project_id || null,
        priority: priority || "medium",
        meeting_date: meeting_date || null,
        meeting_time: meeting_time || null,
        status: "scheduled",
        created_by: user.id,
        org_id: user.org_id,
        parent_meeting_id: parent_meeting_id || null,
      }])
      .select("id")
      .single();
    if (error) return json({ error: error.message }, 400);
    if (assignee_ids.length && meeting?.id) {
      const { error: aErr } = await supabase.from("meeting_assignees").insert(
        assignee_ids.map((profile_id) => ({ meeting_id: meeting.id, profile_id })),
      );
      if (aErr) {
        await supabase.from("meetings").delete().eq("id", meeting.id);
        return json({ error: aErr.message }, 400);
      }
    }
    const { data: full, error: fErr } = await supabase.from("meetings").select("*").eq("id", meeting!.id).single();
    if (fErr) return json({ error: fErr.message }, 400);
    const shaped = await shapeMeetingsWithJoins([full]);
    const out = shaped[0];
    scheduleAudit(() =>
      logMeetingHistory(out.id, user.id, user.org_id, "created", {
        title: out.title,
        priority: out.priority,
        meeting_date: out.meeting_date ?? null,
        meeting_time: out.meeting_time ?? null,
        project_id: out.project_id ?? null,
        assignee_ids: out.assignee_ids ?? [],
        parent_meeting_id: out.parent_meeting_id ?? null,
      }, null)
    );
    scheduleNotify(async () => {
      const who = await getActorDisplayName(supabase, user.id);
      await notifyUsersEdge(supabase, {
        userIds: out.assignee_ids || [],
        excludeUserId: user.id,
        category: "meeting_assigned",
        title: "New meeting assigned",
        body: `${who} added you: ${out.title}`,
        data: { type: "meeting", meetingId: String(out.id), url: "/" },
      });
      await whatsappNotifyAssignees("meeting", out, who, user.id);
    });
    return json(out, 201);
  }

  // POST /meetings/import — admin-only bulk CSV import.
  if (req.method === "POST" && path === "/meetings/import") {
    const adminErr = requireAdmin(user);
    if (adminErr) return adminErr;
    if (!user.org_id) return json({ error: "Your profile has no organization." }, 400);

    const body = (await parseBody(req)) as { filename?: string; rows?: Record<string, string>[] };
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!rows.length) return json({ error: "No rows in payload." }, 400);
    if (rows.length > 1000) return json({ error: "Too many rows (limit 1000 per import)." }, 400);

    const created: { id: string; title: string; row: number }[] = [];
    const skipped: { row: number; reason: string; title?: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2;
      const c = canonicalize(rows[i] || {}, "meeting");

      if (!c.title) {
        skipped.push({ row: rowNum, reason: "Missing title" });
        continue;
      }
      const meeting_date = c.meeting_date ? parseFlexDate(c.meeting_date) : "";
      if (c.meeting_date && !meeting_date) {
        skipped.push({ row: rowNum, title: c.title, reason: `Unrecognised meeting_date: "${c.meeting_date}"` });
        continue;
      }
      const meeting_time = c.meeting_time ? parseFlexTime(c.meeting_time) : "";
      if (c.meeting_time && !meeting_time) {
        skipped.push({ row: rowNum, title: c.title, reason: `Unrecognised meeting_time: "${c.meeting_time}"` });
        continue;
      }

      const assigneesRes = await resolveAssignees(user.org_id, c.assignees);
      if (!assigneesRes.ids.length) {
        skipped.push({ row: rowNum, title: c.title, reason: assigneesRes.unresolved.length
          ? `No matching participant for: ${assigneesRes.unresolved.join(", ")}`
          : "At least one participant is required" });
        continue;
      }

      const project_id = c.project ? await resolveProject(user.org_id, c.project) : null;
      if (c.project && !project_id) {
        skipped.push({ row: rowNum, title: c.title, reason: `Project "${c.project}" not found in this workspace` });
        continue;
      }

      const priority = parsePriority(c.priority);
      const primary = assigneesRes.ids[0];

      const { data: meeting, error } = await supabase
        .from("meetings")
        .insert([{
          title: c.title,
          description: c.description || null,
          assignee_id: primary,
          project_id,
          priority,
          meeting_date: meeting_date || null,
          meeting_time: meeting_time || null,
          status: "scheduled",
          created_by: user.id,
          org_id: user.org_id,
        }])
        .select("id")
        .single();

      if (error || !meeting) {
        skipped.push({ row: rowNum, title: c.title, reason: error?.message || "Insert failed" });
        continue;
      }

      if (assigneesRes.ids.length > 0) {
        const { error: aErr } = await supabase.from("meeting_assignees").insert(
          assigneesRes.ids.map((profile_id) => ({ meeting_id: meeting.id, profile_id })),
        );
        if (aErr) {
          await supabase.from("meetings").delete().eq("id", meeting.id);
          skipped.push({ row: rowNum, title: c.title, reason: `Participant link failed: ${aErr.message}` });
          continue;
        }
      }

      created.push({ id: meeting.id, title: c.title, row: rowNum });
      scheduleAudit(() =>
        logMeetingHistory(meeting.id, user.id, user.org_id, "created", {
          via: "csv_import",
          title: c.title,
          priority,
          meeting_date: meeting_date || null,
          meeting_time: meeting_time || null,
          project_id,
          assignee_ids: assigneesRes.ids,
        }, null)
      );
    }

    try {
      await supabase.from("import_logs").insert([{
        org_id: user.org_id,
        actor_id: user.id,
        kind: "meeting",
        filename: body.filename || null,
        total_rows: rows.length,
        created_count: created.length,
        skipped_count: skipped.length,
        errors: skipped,
        created_ids: created.map((c) => c.id),
      }]);
    } catch (e) {
      console.warn("[import_logs] insert failed:", (e as Error)?.message);
    }

    return json({
      total: rows.length,
      created: created.length,
      skipped: skipped.length,
      errors: skipped,
      created_items: created,
    });
  }

  const statusMatch = path.match(/^\/meetings\/([^/]+)\/status$/);
  if (req.method === "PATCH" && statusMatch) {
    const id = statusMatch[1];
    const body = await parseBody(req);
    const status = (body as any).status;
    if (!status) return json({ error: "Status is required" }, 400);
    if (user.role !== "admin") {
      let rq = supabase.from("meetings").select("id, assignee_id").eq("id", id);
      if (user.org_id) rq = rq.eq("org_id", user.org_id);
      const { data: row } = await rq.maybeSingle();
      if (!row) return json({ error: "Meeting not found or access denied" }, 404);
      const { data: inj } = await supabase.from("meeting_assignees").select("meeting_id").eq("meeting_id", id).eq("profile_id", user.id).maybeSingle();
      if (row.assignee_id !== user.id && !inj) return json({ error: "Meeting not found or access denied" }, 403);
    }
    const { data: beforeMRow } = await supabase.from("meetings").select("status").eq("id", id).maybeSingle();
    let uq = supabase
      .from("meetings")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (user.org_id) uq = uq.eq("org_id", user.org_id);
    const { data, error } = await uq
      .select("*")
      .maybeSingle();
    if (error) return json({ error: error.message }, 400);
    if (!data) return json({ error: "Meeting not found or access denied" }, 404);
    const shaped = await shapeMeetingsWithJoins([data]);
    const out = shaped[0];
    const prevMStatus = (beforeMRow as { status?: string } | null)?.status ?? null;
    if (prevMStatus !== status) {
      scheduleAudit(() =>
        logMeetingHistory(id, user.id, user.org_id, "status_changed", { status: { from: prevMStatus, to: status } }, null)
      );
    }
    scheduleNotify(async () => {
      const who = await getActorDisplayName(supabase, user.id);
      await notifyUsersEdge(supabase, {
        userIds: out.assignee_ids || [],
        excludeUserId: user.id,
        category: "meeting_update",
        title: "Meeting status updated",
        body: `${who} set "${out.title}" to ${status}`,
        data: { type: "meeting", meetingId: id, url: "/" },
      });
    });
    return json(out);
  }

  const patchMeetingDetail = path.match(/^\/meetings\/([^/]+)$/);
  if (req.method === "PATCH" && patchMeetingDetail) {
    const id = patchMeetingDetail[1];
    const adminErr = requireAdmin(user);
    if (adminErr) return adminErr;
    const deny = await assertMeetingAccess(user, id);
    if (deny) return deny;
    const body = await parseBody(req) as Record<string, unknown>;
    const {
      title,
      description,
      priority,
      meeting_date,
      meeting_time,
      project_id,
    } = body as any;
    const parent_meeting_id_in = (body as any).parent_meeting_id ?? (body as any).parentMeetingId;
    if (title !== undefined && !String(title).trim()) return json({ error: "Title cannot be empty" }, 400);
    if (project_id) {
      const { data: proj } = await supabase.from("projects").select("id").eq("id", project_id).eq("org_id", user.org_id).maybeSingle();
      if (!proj) return json({ error: "Project not found" }, 400);
    }
    if (parent_meeting_id_in !== undefined) {
      const nextParent = parent_meeting_id_in === null || parent_meeting_id_in === ""
        ? null
        : String(parent_meeting_id_in);
      if (nextParent !== null) {
        const pErr = await validateParentMeetingEdge(user, nextParent);
        if (pErr) return pErr;
        if (nextParent === id) return json({ error: "Meeting cannot be its own parent" }, 400);
      }
    }
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (title !== undefined) patch.title = String(title).trim();
    if (description !== undefined) patch.description = description;
    if (priority !== undefined) patch.priority = priority;
    if (meeting_date !== undefined) patch.meeting_date = meeting_date || null;
    if (meeting_time !== undefined) patch.meeting_time = meeting_time || null;
    if (project_id !== undefined) patch.project_id = project_id || null;
    if (parent_meeting_id_in !== undefined) {
      patch.parent_meeting_id = parent_meeting_id_in === null || parent_meeting_id_in === ""
        ? null
        : String(parent_meeting_id_in);
    }

    const assignee_ids = body.assignee_ids !== undefined || body.assigneeIds !== undefined
      ? normalizeAssigneeIds(body)
      : null;

    let previousMeetingAssigneeIds: string[] = [];
    if (assignee_ids !== null) {
      const { data: oldLinks } = await supabase.from("meeting_assignees").select("profile_id").eq("meeting_id", id);
      previousMeetingAssigneeIds = [...new Set((oldLinks ?? []).map((r: { profile_id: string }) => r.profile_id))];
    }

    const { data: before } = await supabase.from("meetings").select("*").eq("id", id).single();
    if (!before) return json({ error: "Meeting not found" }, 404);

    let patchQ = supabase.from("meetings").update(patch).eq("id", id);
    if (user.org_id) patchQ = patchQ.eq("org_id", user.org_id);
    const { error: upErr } = await patchQ;
    if (upErr) return json({ error: upErr.message }, 400);

    if (assignee_ids !== null) {
      await supabase.from("meeting_assignees").delete().eq("meeting_id", id);
      const primary = assignee_ids[0] ?? null;
      let primQ = supabase.from("meetings").update({ assignee_id: primary }).eq("id", id);
      if (user.org_id) primQ = primQ.eq("org_id", user.org_id);
      await primQ;
      if (assignee_ids.length) {
        const { error: aErr } = await supabase.from("meeting_assignees").insert(
          assignee_ids.map((profile_id) => ({ meeting_id: id, profile_id })),
        );
        if (aErr) return json({ error: aErr.message }, 400);
      }
    }

    const { data: full, error: fErr } = await supabase.from("meetings").select("*").eq("id", id).single();
    if (fErr) return json({ error: fErr.message }, 400);
    const shaped = await shapeMeetingsWithJoins([full]);
    const out = shaped[0];
    const fieldChangesM = diffForHistory(before as Record<string, unknown>, patch);
    let assigneeDiffM: { added: string[]; removed: string[] } | null = null;
    if (assignee_ids !== null) {
      const oldSet = new Set(previousMeetingAssigneeIds);
      const newSet = new Set(out.assignee_ids || []);
      const added = (out.assignee_ids || []).filter((uid: string) => !oldSet.has(uid));
      const removed = previousMeetingAssigneeIds.filter((uid) => !newSet.has(uid));
      if (added.length || removed.length) assigneeDiffM = { added, removed };
      if (added.length) {
        scheduleNotify(async () => {
          const who = await getActorDisplayName(supabase, user.id);
          await notifyUsersEdge(supabase, {
            userIds: added,
            excludeUserId: user.id,
            category: "meeting_assigned",
            title: "Meeting participants updated",
            body: `${who} added you to: ${out.title}`,
            data: { type: "meeting", meetingId: id, url: "/" },
          });
        });
      }
    }
    const hasFieldChangesM = Object.keys(fieldChangesM).length > 0;
    if (hasFieldChangesM || assigneeDiffM) {
      const changes: HistoryChanges = { ...fieldChangesM };
      if (assigneeDiffM) changes.assignees = assigneeDiffM;
      scheduleAudit(() => logMeetingHistory(id, user.id, user.org_id, "updated", changes, null));
    }
    return json(out);
  }

  // GET /meetings/:id/history
  const historyMatchM = path.match(/^\/meetings\/([^/]+)\/history$/);
  if (req.method === "GET" && historyMatchM) {
    const id = historyMatchM[1];
    const deny = await assertMeetingAccess(user, id);
    if (deny) return deny;
    const { data, error } = await supabase
      .from("meeting_history")
      .select("id, meeting_id, actor_id, action, changes, note, created_at")
      .eq("meeting_id", id)
      .order("created_at", { ascending: true });
    if (error) return json({ error: error.message }, 400);
    return json(data ?? []);
  }

  // POST /meetings/:id/submit
  const submitMatchM = path.match(/^\/meetings\/([^/]+)\/submit$/);
  if (req.method === "POST" && submitMatchM) {
    const id = submitMatchM[1];
    const deny = await assertMeetingAccess(user, id);
    if (deny) return deny;
    const body = await parseBody(req) as Record<string, unknown>;
    const note = typeof body.note === "string" ? String(body.note).trim() : "";
    let uq = supabase
      .from("meetings")
      .update({
        status: "submitted",
        submission_notes: note || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (user.org_id) uq = uq.eq("org_id", user.org_id);
    const { data, error } = await uq.select("*").maybeSingle();
    if (error) return json({ error: error.message }, 400);
    if (!data) return json({ error: "Meeting not found or access denied" }, 404);
    const shaped = await shapeMeetingsWithJoins([data]);
    const out = shaped[0];
    scheduleAudit(() =>
      logMeetingHistory(id, user.id, user.org_id, "submitted", { status: { from: null, to: "submitted" } }, note || null)
    );
    scheduleNotify(async () => {
      const who = await getActorDisplayName(supabase, user.id);
      await notifyUsersEdge(supabase, {
        userIds: out.assignee_ids || [],
        excludeUserId: user.id,
        category: "meeting_update",
        title: "Meeting submitted for review",
        body: `${who} submitted: ${out.title}`,
        data: { type: "meeting", meetingId: id, url: "/" },
      });
    });
    return json(out);
  }

  // POST /meetings/:id/approve
  const approveMatchM = path.match(/^\/meetings\/([^/]+)\/approve$/);
  if (req.method === "POST" && approveMatchM) {
    const adminErr = requireAdmin(user);
    if (adminErr) return adminErr;
    const id = approveMatchM[1];
    const deny = await assertMeetingAccess(user, id);
    if (deny) return deny;
    const body = await parseBody(req) as Record<string, unknown>;
    const note = typeof body.note === "string" ? String(body.note).trim() : "";
    let uq = supabase
      .from("meetings")
      .update({
        status: "completed",
        approval_notes: note || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (user.org_id) uq = uq.eq("org_id", user.org_id);
    const { data, error } = await uq.select("*").maybeSingle();
    if (error) return json({ error: error.message }, 400);
    if (!data) return json({ error: "Meeting not found" }, 404);
    const shaped = await shapeMeetingsWithJoins([data]);
    const out = shaped[0];
    scheduleAudit(() =>
      logMeetingHistory(id, user.id, user.org_id, "approved", { status: { from: null, to: "completed" } }, note || null)
    );
    scheduleNotify(async () => {
      const who = await getActorDisplayName(supabase, user.id);
      await notifyUsersEdge(supabase, {
        userIds: out.assignee_ids || [],
        excludeUserId: user.id,
        category: "meeting_update",
        title: "Meeting approved",
        body: `${who} approved: ${out.title}`,
        data: { type: "meeting", meetingId: id, url: "/" },
      });
    });
    return json(out);
  }

  // POST /meetings/:id/request-changes
  const requestChangesMatchM = path.match(/^\/meetings\/([^/]+)\/request-changes$/);
  if (req.method === "POST" && requestChangesMatchM) {
    const adminErr = requireAdmin(user);
    if (adminErr) return adminErr;
    const id = requestChangesMatchM[1];
    const deny = await assertMeetingAccess(user, id);
    if (deny) return deny;
    const body = await parseBody(req) as Record<string, unknown>;
    const note = typeof body.note === "string" ? String(body.note).trim() : "";
    if (!note) return json({ error: "Please describe the changes requested" }, 400);
    let uq = supabase
      .from("meetings")
      .update({
        status: "changes_requested",
        approval_notes: note,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (user.org_id) uq = uq.eq("org_id", user.org_id);
    const { data, error } = await uq.select("*").maybeSingle();
    if (error) return json({ error: error.message }, 400);
    if (!data) return json({ error: "Meeting not found" }, 404);
    const shaped = await shapeMeetingsWithJoins([data]);
    const out = shaped[0];
    scheduleAudit(() =>
      logMeetingHistory(id, user.id, user.org_id, "changes_requested", { status: { from: null, to: "changes_requested" } }, note)
    );
    scheduleNotify(async () => {
      const who = await getActorDisplayName(supabase, user.id);
      await notifyUsersEdge(supabase, {
        userIds: out.assignee_ids || [],
        excludeUserId: user.id,
        category: "meeting_update",
        title: "Changes requested",
        body: `${who} requested changes on: ${out.title}`,
        data: { type: "meeting", meetingId: id, url: "/" },
      });
    });
    return json(out);
  }

  const delMatch = path.match(/^\/meetings\/([^/]+)$/);
  if (req.method === "DELETE" && delMatch) {
    const adminErr = requireAdmin(user);
    if (adminErr) return adminErr;
    const id = delMatch[1];
    let delQ = supabase.from("meetings").delete().eq("id", id);
    if (user.org_id) delQ = delQ.eq("org_id", user.org_id);
    const { error } = await delQ;
    if (error) return json({ error: error.message }, 400);
    return json({ message: "Deleted" });
  }

  // Attachments list
  const listMatch = path.match(/^\/meetings\/([^/]+)\/attachments$/);
  if (req.method === "GET" && listMatch) {
    const id = listMatch[1];
    const meeting = await fetchMeetingWithAssignees(id, user.org_id);
    if (!meetingCanBeAccessedBy(user, meeting)) return json({ error: "Meeting not found or access denied" }, 404);

    const { data, error } = await supabase
      .from("meeting_attachments")
      .select("id, type, original_name, content_type, size_bytes, created_at")
      .eq("meeting_id", id)
      .order("created_at", { ascending: false });
    if (error) return json({ error: error.message }, 400);
    return json(data ?? []);
  }

  // Attachment upload — anyone with access to the meeting (admin or
  // participant) may attach files.
  if (req.method === "POST" && listMatch) {
    const id = listMatch[1];
    const meeting = await fetchMeetingWithAssignees(id, user.org_id);
    if (!meeting || !meetingCanBeAccessedBy(user, meeting)) return json({ error: "Meeting not found or access denied" }, 404);
    const orgKey = user.org_id || (meeting as { org_id?: string }).org_id;
    if (!orgKey) return json({ error: "Cannot determine organization for this meeting; cannot upload files." }, 400);

    const form = await req.formData();
    const type = String(form.get("type") || "other");
    const file = form.get("file");
    if (!(file instanceof File)) return json({ error: "File is required" }, 400);

    const safeName = file.name.replace(/[^\w.\-() ]+/g, "_");
    const pathKey = `${orgKey}/${id}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
    const fileBuf = new Uint8Array(await file.arrayBuffer());

    const { error: upErr } = await supabase.storage
      .from("meeting-assets")
      .upload(pathKey, fileBuf, { contentType: file.type || "application/octet-stream", upsert: false });
    if (upErr) return json({ error: upErr.message }, 400);

    const primaryAssignee = meetingAssigneeIds(meeting)[0] ?? meeting.assignee_id ?? null;
    const { data: row, error: insErr } = await supabase
      .from("meeting_attachments")
      .insert([{
        org_id: orgKey,
        meeting_id: id,
        assignee_id: primaryAssignee,
        type,
        bucket: "meeting-assets",
        path: pathKey,
        original_name: file.name,
        content_type: file.type,
        size_bytes: file.size,
        created_by: user.id,
      }])
      .select("id, type, original_name, content_type, size_bytes, created_at")
      .single();
    if (insErr) return json({ error: insErr.message }, 400);
    return json(row, 201);
  }

  const downMatch = path.match(/^\/meetings\/attachments\/([^/]+)\/download$/);
  if (req.method === "GET" && downMatch) {
    const attId = downMatch[1];
    const { data: att, error } = await supabase
      .from("meeting_attachments")
      .select("id, meeting_id, org_id, assignee_id, bucket, path")
      .eq("id", attId)
      .maybeSingle();
    if (error) return json({ error: error.message }, 400);
    if (!att) return json({ error: "Attachment not found" }, 404);
    const meeting = await fetchMeetingWithAssignees(att.meeting_id, null);
    if (!meetingCanBeAccessedBy(user, meeting)) return json({ error: "Access denied" }, 403);

    const { data: signed, error: sErr } = await supabase.storage.from(att.bucket).createSignedUrl(att.path, 600);
    if (sErr) return json({ error: sErr.message }, 400);
    return Response.redirect(signed.signedUrl, 302);
  }

  return null;
}

async function handleProjects(req: Request, path: string) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  if (req.method === "GET" && path === "/projects") {
    if (!user.org_id) return json([]);
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, description, created_at")
      .eq("org_id", user.org_id)
      .order("created_at", { ascending: false });
    if (error) return json({ error: error.message }, 400);
    return json(data ?? []);
  }

  const progressMatch = path.match(/^\/projects\/([^/]+)\/progress$/);
  if (req.method === "GET" && progressMatch) {
    const projectId = progressMatch[1];
    if (!user.org_id) {
      return json({ total: 0, completed: 0, pending: 0, in_progress: 0, blocked: 0, percent_complete: 0 });
    }
    const { data: proj } = await supabase.from("projects").select("id").eq("id", projectId).eq("org_id", user.org_id).maybeSingle();
    if (!proj) return json({ error: "Project not found" }, 404);
    const { data: pt, error } = await supabase.from("tasks").select("status").eq("org_id", user.org_id).eq("project_id", projectId);
    if (error) return json({ error: error.message }, 400);
    const tasks = pt ?? [];
    const total = tasks.length;
    const completed = tasks.filter((t: { status: string }) => t.status === "completed").length;
    const pending = tasks.filter((t: { status: string }) => t.status === "pending").length;
    const in_progress = tasks.filter((t: { status: string }) => t.status === "in_progress").length;
    const blocked = tasks.filter((t: { status: string }) => t.status === "blocked").length;
    const percent_complete = total ? Math.round((completed / total) * 100) : 0;
    return json({ total, completed, pending, in_progress, blocked, percent_complete });
  }

  if (req.method === "POST" && path === "/projects") {
    const adminErr = requireAdmin(user);
    if (adminErr) return adminErr;
    if (!user.org_id) {
      return json({ error: "Your profile has no organization; cannot create projects." }, 400);
    }
    const body = await parseBody(req);
    const { name, description } = body as any;
    if (!name?.trim()) return json({ error: "Project name is required" }, 400);
    const { data, error } = await supabase
      .from("projects")
      .insert([{
        name: name.trim(),
        description: description || null,
        org_id: user.org_id,
        created_by: user.id,
      }])
      .select()
      .single();
    if (error) return json({ error: error.message }, 400);
    return json(data, 201);
  }

  return null;
}

async function handleAdmin(req: Request, path: string) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;
  const adminErr = requireAdmin(user);
  if (adminErr) return adminErr;

  if (req.method === "GET" && path === "/admin/overview-stats") {
    if (!user.org_id) {
      return json({
        pending_tasks: 0,
        completed_tasks: 0,
        overdue_tasks: 0,
        pending_meetings: 0,
        completed_meetings: 0,
        overdue_meetings: 0,
        total_users: 0,
      });
    }
    const today = new Date().toISOString().split("T")[0];
    const roleById = await loadOrgRoleByIdForEdge(user.org_id);
    const { data: tasks, error: tErr } = await supabase
      .from("tasks")
      .select("id, status, due_date, created_by, assignee_id, task_assignees(profile_id)")
      .eq("org_id", user.org_id);
    if (tErr) return json({ error: tErr.message }, 500);
    const { data: meetings, error: mErr } = await supabase
      .from("meetings")
      .select("id, status, meeting_date, created_by, assignee_id, meeting_assignees(profile_id)")
      .eq("org_id", user.org_id);
    if (mErr) return json({ error: mErr.message }, 500);
    const { count: userCount, error: uErr } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("org_id", user.org_id);
    if (uErr) return json({ error: uErr.message }, 500);

    const viewerId = user.id;
    const tList = (tasks ?? []).filter((row: any) => edgeAdminSeesItem(row, viewerId, roleById, "task"));
    const mList = (meetings ?? []).filter((row: any) => edgeAdminSeesItem(row, viewerId, roleById, "meeting"));
    const pending_tasks = tList.filter((t: { status: string }) =>
      t.status === "pending" || t.status === "in_progress" || t.status === "blocked"
    ).length;
    const completed_tasks = tList.filter((t: { status: string }) => t.status === "completed").length;
    const overdue_tasks = tList.filter((t: { status: string; due_date?: string }) =>
      t.due_date && t.due_date < today && t.status !== "completed"
    ).length;
    const pending_meetings = mList.filter((m: { status: string }) => m.status === "scheduled").length;
    const completed_meetings = mList.filter((m: { status: string }) => m.status === "completed").length;
    const overdue_meetings = mList.filter((m: { status: string; meeting_date?: string }) =>
      m.meeting_date && m.meeting_date < today && m.status === "scheduled"
    ).length;
    const total_users = userCount ?? 0;

    return json({
      pending_tasks,
      completed_tasks,
      overdue_tasks,
      pending_meetings,
      completed_meetings,
      overdue_meetings,
      total_users,
    });
  }

  if (req.method === "GET" && path === "/admin/dashboard") {
    if (!user.org_id) {
      return json({ total: 0, completed: 0, overdue: 0, pending: 0, in_progress: 0, blocked: 0 });
    }
    const today = new Date().toISOString().split("T")[0];
    const roleById = await loadOrgRoleByIdForEdge(user.org_id);
    const { data: tasks, error } = await supabase
      .from("tasks")
      .select("id, status, due_date, created_by, assignee_id, task_assignees(profile_id)")
      .eq("org_id", user.org_id);
    if (error) return json({ error: error.message }, 500);
    const viewerId = user.id;
    const filtered = (tasks ?? []).filter((row: any) => edgeAdminSeesItem(row, viewerId, roleById, "task"));
    const total = filtered.length;
    const completed = filtered.filter((t: any) => t.status === "completed").length;
    const overdue = filtered.filter((t: any) => t.due_date && t.due_date < today && t.status !== "completed").length;
    const pending = filtered.filter((t: any) => t.status === "pending").length;
    const in_progress = filtered.filter((t: any) => t.status === "in_progress").length;
    const blocked = filtered.filter((t: any) => t.status === "blocked").length;
    return json({ total, completed, overdue, pending, in_progress, blocked });
  }

  if (req.method === "GET" && path === "/admin/users") {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, phone, created_at")
      .eq("org_id", user.org_id)
      .order("created_at", { ascending: true });
    if (error) return json({ error: error.message }, 500);
    return json(data ?? []);
  }

  if (req.method === "POST" && path === "/admin/users") {
    const body = await parseBody(req);
    const { email, password, fullName, role: rawRole = "employee" } = body as any;
    const phone = typeof (body as any).phone === "string" ? (body as any).phone.trim() : "";
    if (!email || !password || !fullName) return json({ error: "Email, password and full name are required" }, 400);
    if (!user.org_id) {
      return json({ error: "Your profile has no organization; cannot create users." }, 400);
    }
    const role = rawRole === "admin" ? "admin" : "employee";

    const { data: created, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role,
        org_id: String(user.org_id),
        phone: phone || null,
      },
    });
    if (error) return json({ error: error.message }, error.status || 400);

    const userId = created.user?.id;
    if (userId) {
      const { error: upErr } = await supabase.from("profiles").upsert(
        { id: userId, email, full_name: fullName, role, org_id: user.org_id, phone: phone || null },
        { onConflict: "id" },
      );
      if (upErr) {
        const { data: row } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
        if (!row) {
          return json(
            { error: "User created but profile linking failed", detail: upErr.message },
            500,
          );
        }
      }
    }

    return json({
      message: "User created",
      user_id: created.user?.id,
      email,
      full_name: fullName,
      role,
      phone: phone || null,
    }, 201);
  }

  // Admin: change a user's password
  const pwMatch = path.match(/^\/admin\/users\/([^/]+)\/password$/);
  if (req.method === "POST" && pwMatch) {
    const targetId = pwMatch[1];
    const body = await parseBody(req);
    const newPassword = typeof (body as any).password === "string" ? (body as any).password : "";
    if (!newPassword || newPassword.length < 6) {
      return json({ error: "Password must be at least 6 characters." }, 400);
    }
    if (!user.org_id) return json({ error: "Your profile has no organization." }, 400);
    const { data: target } = await supabase
      .from("profiles").select("id, org_id, email").eq("id", targetId).maybeSingle();
    if (!target || target.org_id !== user.org_id) {
      return json({ error: "User not found in your organization." }, 404);
    }
    const { error } = await supabase.auth.admin.updateUserById(targetId, { password: newPassword });
    if (error) return json({ error: error.message }, (error as any).status || 400);
    return json({ message: "Password updated", user_id: targetId, email: target.email });
  }

  // Admin: edit an existing user's profile (mobile number, full name)
  const editUserMatch = path.match(/^\/admin\/users\/([^/]+)$/);
  if (req.method === "PATCH" && editUserMatch) {
    const targetId = editUserMatch[1];
    if (!user.org_id) return json({ error: "Your profile has no organization." }, 400);
    const { data: target } = await supabase
      .from("profiles").select("id, org_id").eq("id", targetId).maybeSingle();
    if (!target || target.org_id !== user.org_id) {
      return json({ error: "User not found in your organization." }, 404);
    }
    const body = await parseBody(req);
    const updates: Record<string, unknown> = {};
    if (typeof (body as any).phone === "string") {
      updates.phone = (body as any).phone.trim() || null;
    }
    if (typeof (body as any).fullName === "string" && (body as any).fullName.trim()) {
      updates.full_name = (body as any).fullName.trim();
    }
    if (Object.keys(updates).length === 0) return json({ error: "Nothing to update." }, 400);
    const { error: upErr } = await supabase.from("profiles").update(updates).eq("id", targetId);
    if (upErr) return json({ error: upErr.message }, 500);
    const { data: updated } = await supabase
      .from("profiles").select("id, email, full_name, role, phone, created_at").eq("id", targetId).maybeSingle();
    return json({ message: "User updated", user: updated });
  }

  // Admin: delete a user (unassigns their tasks/meetings, then removes profile + auth user)
  const delUserMatch = path.match(/^\/admin\/users\/([^/]+)$/);
  if (req.method === "DELETE" && delUserMatch) {
    const targetId = delUserMatch[1];
    if (!user.org_id) return json({ error: "Your profile has no organization." }, 400);
    if (targetId === user.id) return json({ error: "You cannot delete your own account." }, 400);
    const { data: target } = await supabase
      .from("profiles").select("id, org_id").eq("id", targetId).maybeSingle();
    if (!target || target.org_id !== user.org_id) {
      return json({ error: "User not found in your organization." }, 404);
    }
    // Detach references so FK constraints don't block deletion (keep the records, just unlink the user).
    await supabase.from("tasks").update({ assignee_id: null }).eq("assignee_id", targetId);
    await supabase.from("tasks").update({ created_by: null }).eq("created_by", targetId);
    await supabase.from("meetings").update({ assignee_id: null }).eq("assignee_id", targetId);
    await supabase.from("meetings").update({ created_by: null }).eq("created_by", targetId);
    await supabase.from("meeting_attachments").update({ assignee_id: null }).eq("assignee_id", targetId);
    await supabase.from("meeting_attachments").update({ created_by: null }).eq("created_by", targetId);
    await supabase.from("task_attachments").update({ assignee_id: null }).eq("assignee_id", targetId);
    await supabase.from("task_attachments").update({ created_by: null }).eq("created_by", targetId);
    await supabase.from("projects").update({ created_by: null }).eq("created_by", targetId);
    // Delete profile (cascades task_assignees/meeting_assignees/prefs/subscriptions; history actor -> null).
    const { error: pErr } = await supabase.from("profiles").delete().eq("id", targetId);
    if (pErr) return json({ error: "Failed to delete user profile", detail: pErr.message }, 500);
    // Delete the auth user.
    const { error: aErr } = await supabase.auth.admin.deleteUser(targetId);
    if (aErr) return json({ error: "Profile removed but auth user delete failed", detail: aErr.message }, 500);
    return json({ message: "User deleted", user_id: targetId });
  }

  // ── Join requests (users who signed up and entered this org's 6-digit code) ──
  if (req.method === "GET" && path === "/admin/join-requests") {
    if (!user.org_id) return json([]);
    const { data, error } = await supabase.from("org_join_requests")
      .select("id, status, created_at, decided_at, profile:profiles!profile_id(id, full_name, email, phone)")
      .eq("org_id", user.org_id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return json({ error: error.message }, 500);
    return json(data ?? []);
  }

  const jrMatch = path.match(/^\/admin\/join-requests\/([^/]+)\/(approve|reject)$/);
  if (req.method === "POST" && jrMatch) {
    const [, reqId, action] = jrMatch;
    if (!user.org_id) return json({ error: "Your profile has no organization." }, 400);
    const { data: jr } = await supabase.from("org_join_requests")
      .select("id, org_id, profile_id, status").eq("id", reqId).maybeSingle();
    if (!jr || jr.org_id !== user.org_id) return json({ error: "Request not found in your organization." }, 404);
    if (jr.status !== "pending") return json({ error: "This request has already been decided." }, 400);

    if (action === "approve") {
      const { error: pErr } = await supabase.from("profiles")
        .update({ org_id: jr.org_id, role: "employee" }).eq("id", jr.profile_id);
      if (pErr) return json({ error: pErr.message }, 400);
    }
    const { error: uErr } = await supabase.from("org_join_requests").update({
      status: action === "approve" ? "approved" : "rejected",
      decided_at: new Date().toISOString(), decided_by: user.id,
    }).eq("id", reqId);
    if (uErr) return json({ error: uErr.message }, 400);

    scheduleNotify(async () => {
      const { data: p } = await supabase.from("profiles").select("phone").eq("id", jr.profile_id).maybeSingle();
      const chat = p?.phone ? openwaChatId(p.phone) : null;
      if (chat) {
        await openwaSendText(chat, action === "approve"
          ? "✅ Your request to join TaskFlow was *approved*. You can log in now."
          : "❌ Your request to join TaskFlow was *declined*. Please contact your administrator.");
      }
    });
    return json({ ok: true, status: action === "approve" ? "approved" : "rejected" });
  }

  if (req.method === "POST" && path === "/admin/send-reminders") {
    return json({ error: "Not implemented in edge function yet" }, 501);
  }

  return null;
}

Deno.serve(async (req): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const path = stripApiPrefix(new URL(req.url).pathname);

    if (req.method === "GET" && path === "/") return json({ ok: true, service: "edge-api" });

    // Inbound WhatsApp bot webhook (public; validated by shared secret header)
    if (req.method === "POST" && path === "/whatsapp/webhook") return await handleWhatsAppWebhook(req);

    // Hourly cron: 24h due-soon WhatsApp reminders (validated by shared secret header)
    if (req.method === "POST" && path === "/cron/reminders") return await handleCronReminders(req);

    // Axynt AI: inbound tool calls (public; HMAC-verified inside the handler)
    if (req.method === "POST" && path === "/ai-callback") return await handleAiCallback(req);

    // Auth routes
    if (req.method === "POST" && path === "/auth/signup") return await handleAuthSignup(req);
    if (req.method === "POST" && path === "/auth/login") return await handleAuthLogin(req);
    if (req.method === "GET" && path === "/auth/me") return await handleAuthMe(req);
    if (req.method === "GET" && path === "/auth/profiles") return await handleAuthProfiles(req);

    // Signup onboarding: WhatsApp OTP + create/join org (OTP at signup only, never at login)
    if (req.method === "POST" && path === "/auth/otp/send") return await handleOtpSend(req);
    if (req.method === "POST" && path === "/auth/otp/verify") return await handleOtpVerify(req);
    if (req.method === "GET" && path === "/auth/org/lookup") return await handleOrgLookup(req);
    if (req.method === "POST" && path === "/auth/onboarding") return await handleOnboarding(req);

    // In-app AI assistant (web UI)
    if (req.method === "POST" && path === "/ai/query") return await handleAIQuery(req);

    // Outbound: send a signed message to the Axynt agent (authenticated user)
    if (req.method === "POST" && path === "/ai/axynt") return await handleAxyntSend(req);

    const notificationsResp = await handleNotificationRoutes(req, path, supabase, requireAuth);
    if (notificationsResp) return notificationsResp;

    const projectsResp = await handleProjects(req, path);
    if (projectsResp) return projectsResp;

    const tasksResp = await handleTasks(req, path);
    if (tasksResp) return tasksResp;

    const meetingsResp = await handleMeetings(req, path);
    if (meetingsResp) return meetingsResp;

    const adminResp = await handleAdmin(req, path);
    if (adminResp) return adminResp;

    return json({ error: "Not found" }, 404);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return json({ error: msg }, 500);
  }
});

