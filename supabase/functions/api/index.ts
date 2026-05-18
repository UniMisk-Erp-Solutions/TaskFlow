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

async function getAuthUser(req: Request): Promise<AppUser | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, org_id")
    .eq("id", data.user.id)
    .maybeSingle();

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
    user_metadata: { full_name: fullName, role: "admin" },
  });
  if (error) return json({ error: error.message }, error.status || 400);

  const user = created.user;
  let orgId: string | null = null;
  const { data: org } = await supabase
    .from("organizations")
    .insert([{ name: `${fullName}'s workspace` }])
    .select("id")
    .single();
  orgId = org?.id ?? null;

  if (user) {
    await supabase.from("profiles").upsert(
      {
        id: user.id,
        email,
        full_name: fullName,
        role: "admin",
        org_id: orgId,
      },
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
  return json(data);
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
    });
    return json(out, 201);
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
    });
    return json(out, 201);
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

  // Attachment upload
  if (req.method === "POST" && listMatch) {
    const adminErr = requireAdmin(user);
    if (adminErr) return adminErr;
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
      .select("id, email, full_name, role, created_at")
      .eq("org_id", user.org_id)
      .order("created_at", { ascending: true });
    if (error) return json({ error: error.message }, 500);
    return json(data ?? []);
  }

  if (req.method === "POST" && path === "/admin/users") {
    const body = await parseBody(req);
    const { email, password, fullName, role: rawRole = "employee" } = body as any;
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
      },
    });
    if (error) return json({ error: error.message }, error.status || 400);

    const userId = created.user?.id;
    if (userId) {
      const { error: upErr } = await supabase.from("profiles").upsert(
        { id: userId, email, full_name: fullName, role, org_id: user.org_id },
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
    }, 201);
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

    // Auth routes
    if (req.method === "POST" && path === "/auth/signup") return await handleAuthSignup(req);
    if (req.method === "POST" && path === "/auth/login") return await handleAuthLogin(req);
    if (req.method === "GET" && path === "/auth/me") return await handleAuthMe(req);
    if (req.method === "GET" && path === "/auth/profiles") return await handleAuthProfiles(req);

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

