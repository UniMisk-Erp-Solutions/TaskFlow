/**
 * Web Push + notification preferences (mirrors backend/src/services/webPushService.js).
 * Used by Supabase Edge `api` when tasks/meetings change.
 */
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

// `web-push` relies on Node modules that may not load on every Supabase Edge runtime.
// Import lazily so the API never crashes at boot if push libs fail to load.
type WebPushLib = {
  setVapidDetails: (subject: string, pub: string, priv: string) => void;
  sendNotification: (
    sub: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload: string,
    options?: Record<string, unknown>,
  ) => Promise<unknown>;
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

export type NotifyCategory =
  | "task_assigned"
  | "meeting_assigned"
  | "task_update"
  | "meeting_update";

const DEFAULT_PREFS = {
  push_enabled: false,
  notify_task_assigned: true,
  notify_meeting_assigned: true,
  notify_task_updates: true,
  notify_meeting_updates: true,
};

let vapidReady = false;
async function ensureVapid(): Promise<WebPushLib | null> {
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

function prefAllows(prefs: Record<string, unknown> | null, category: NotifyCategory): boolean {
  if (!prefs || !prefs.push_enabled) return false;
  switch (category) {
    case "task_assigned":
      return !!prefs.notify_task_assigned;
    case "meeting_assigned":
      return !!prefs.notify_meeting_assigned;
    case "task_update":
      return !!prefs.notify_task_updates;
    case "meeting_update":
      return !!prefs.notify_meeting_updates;
    default:
      return false;
  }
}

async function getOrCreatePreferences(supabase: SupabaseClient, userId: string) {
  const { data: row } = await supabase.from("notification_preferences").select("*").eq("user_id", userId).maybeSingle();
  if (row) return row;
  const { data: inserted, error } = await supabase
    .from("notification_preferences")
    .insert([{ user_id: userId, ...DEFAULT_PREFS }])
    .select()
    .single();
  if (error) throw error;
  return inserted;
}

async function fetchSubs(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase.from("push_subscriptions").select("*").eq("user_id", userId);
  if (error) throw error;
  return data ?? [];
}

export async function getActorDisplayName(supabase: SupabaseClient, actorId: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("full_name, email").eq("id", actorId).maybeSingle();
  if (!data) return "Someone";
  const name = String(data.full_name || "").trim();
  return name || String(data.email || "") || "Someone";
}

export async function notifyUsersEdge(
  supabase: SupabaseClient,
  opts: {
    userIds: string[];
    excludeUserId?: string;
    category: NotifyCategory;
    title: string;
    body: string;
    data?: Record<string, string>;
  },
): Promise<void> {
  const lib = await ensureVapid();
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
    let prefs: Record<string, unknown>;
    try {
      prefs = (await getOrCreatePreferences(supabase, uid)) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (!prefAllows(prefs, category)) continue;

    let subs: { id: string; endpoint: string; p256dh: string; auth: string }[];
    try {
      subs = (await fetchSubs(supabase, uid)) as typeof subs;
    } catch {
      continue;
    }

    for (const sub of subs) {
      const pushSub = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      };
      try {
        await lib.sendNotification(pushSub, payload, { TTL: 86_400, urgency: "normal" });
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }
  }
}

function jsonBody(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    },
  });
}

async function parseBody(req: Request): Promise<Record<string, unknown>> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

type AppUser = { id: string; role: string; org_id: string | null };

export async function handleNotificationRoutes(
  req: Request,
  path: string,
  supabase: SupabaseClient,
  requireAuthFn: (req: Request) => Promise<{ user: AppUser } | { error: Response }>,
): Promise<Response | null> {
  if (!path.startsWith("/notifications/")) return null;

  if (req.method === "GET" && path === "/notifications/vapid-public-key") {
    const pub = Deno.env.get("VAPID_PUBLIC_KEY");
    if (!pub) return jsonBody({ error: "Push notifications are not configured (missing VAPID keys)." }, 503);
    return jsonBody({ publicKey: pub });
  }

  const authResult = await requireAuthFn(req) as { user: AppUser } | { error: Response };
  if ("error" in authResult) return authResult.error;

  const userId = authResult.user.id;

  if (req.method === "GET" && path === "/notifications/preferences") {
    const prefs = await getOrCreatePreferences(supabase, userId);
    return jsonBody(prefs);
  }

  if (req.method === "PATCH" && path === "/notifications/preferences") {
    const body = await parseBody(req);
    const allowed = [
      "push_enabled",
      "notify_task_assigned",
      "notify_meeting_assigned",
      "notify_task_updates",
      "notify_meeting_updates",
    ] as const;
    const next: Record<string, boolean | string> = { updated_at: new Date().toISOString() };
    for (const k of allowed) {
      if (Object.prototype.hasOwnProperty.call(body, k)) next[k] = !!body[k];
    }
    await getOrCreatePreferences(supabase, userId);
    const keys = allowed.filter((k) => Object.prototype.hasOwnProperty.call(body, k));
    if (!keys.length) {
      const prefs = await getOrCreatePreferences(supabase, userId);
      return jsonBody(prefs);
    }
    const { data, error } = await supabase.from("notification_preferences").update(next).eq("user_id", userId).select()
      .single();
    if (error) return jsonBody({ error: error.message }, 400);
    return jsonBody(data);
  }

  if (req.method === "POST" && path === "/notifications/subscribe") {
    const lib = await ensureVapid();
    if (!lib) return jsonBody({ error: "Push notifications are not configured." }, 503);
    const sub = await parseBody(req) as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };
    if (!sub.endpoint || !sub.keys?.p256dh || !sub.auth) {
      return jsonBody({ error: "Invalid push subscription" }, 400);
    }
    await supabase.from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", sub.endpoint);
    const { error } = await supabase.from("push_subscriptions").insert([{
      user_id: userId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      user_agent: req.headers.get("user-agent") || null,
    }]);
    if (error) return jsonBody({ error: error.message }, 400);
    await getOrCreatePreferences(supabase, userId);
    const { data } = await supabase.from("notification_preferences").update({
      push_enabled: true,
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId).select().single();
    return jsonBody({ ok: true, preferences: data }, 201);
  }

  if (req.method === "POST" && path === "/notifications/unsubscribe") {
    const body = await parseBody(req) as { endpoint?: string };
    if (body.endpoint) {
      await supabase.from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", body.endpoint);
    } else {
      await supabase.from("push_subscriptions").delete().eq("user_id", userId);
    }
    const { count } = await supabase.from("push_subscriptions").select("id", { count: "exact", head: true }).eq(
      "user_id",
      userId,
    );
    let prefsRow;
    if (!count || count === 0) {
      await getOrCreatePreferences(supabase, userId);
      const { data } = await supabase.from("notification_preferences").update({
        push_enabled: false,
        updated_at: new Date().toISOString(),
      }).eq("user_id", userId).select().single();
      prefsRow = data;
    } else {
      prefsRow = await getOrCreatePreferences(supabase, userId);
    }
    return jsonBody({ ok: true, preferences: prefsRow });
  }

  return null;
}

export function scheduleNotify(fn: () => Promise<void>): void {
  queueMicrotask(() => {
    fn().catch((e) => console.error("[push]", e));
  });
}
