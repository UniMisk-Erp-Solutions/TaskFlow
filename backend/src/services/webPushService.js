const webpush = require("web-push");
const supabase = require("../config/supabase");

const DEFAULT_PREFS = {
  push_enabled: false,
  notify_task_assigned: true,
  notify_meeting_assigned: true,
  notify_task_updates: true,
  notify_meeting_updates: true,
};

let vapidConfigured = false;

function ensureVapid() {
  if (vapidConfigured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:noreply@localhost";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  vapidConfigured = true;
  return true;
}

function isPushConfigured() {
  return ensureVapid();
}

/**
 * @param {'task_assigned'|'meeting_assigned'|'task_update'|'meeting_update'} category
 */
function prefAllows(prefs, category) {
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

async function getOrCreatePreferences(userId) {
  const { data: row } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (row) return row;
  const { data: inserted, error } = await supabase
    .from("notification_preferences")
    .insert([{ user_id: userId, ...DEFAULT_PREFS }])
    .select()
    .single();
  if (error) throw new Error(error.message);
  return inserted;
}

async function updatePreferences(userId, patch) {
  const allowed = [
    "push_enabled",
    "notify_task_assigned",
    "notify_meeting_assigned",
    "notify_task_updates",
    "notify_meeting_updates",
  ];
  const next = {};
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(patch, k)) next[k] = !!patch[k];
  }
  if (!Object.keys(next).length) {
    return getOrCreatePreferences(userId);
  }
  next.updated_at = new Date().toISOString();
  await getOrCreatePreferences(userId);
  const { data, error } = await supabase
    .from("notification_preferences")
    .update(next)
    .eq("user_id", userId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function saveSubscription(userId, subscription, userAgent) {
  const endpoint = subscription.endpoint;
  const keys = subscription.keys || {};
  const p256dh = keys.p256dh;
  const auth = keys.auth;
  if (!endpoint || !p256dh || !auth) {
    throw new Error("Invalid push subscription payload");
  }
  await supabase.from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", endpoint);
  const { error } = await supabase.from("push_subscriptions").insert([
    {
      user_id: userId,
      endpoint,
      p256dh,
      auth,
      user_agent: userAgent || null,
    },
  ]);
  if (error) throw new Error(error.message);
}

async function removeSubscription(userId, endpoint) {
  if (!endpoint) return;
  let q = supabase.from("push_subscriptions").delete().eq("user_id", userId);
  q = q.eq("endpoint", endpoint);
  await q;
}

async function fetchSubscriptionsForUser(userId) {
  const { data, error } = await supabase.from("push_subscriptions").select("*").eq("user_id", userId);
  if (error) throw new Error(error.message);
  return data || [];
}

async function deleteSubscriptionRow(id) {
  await supabase.from("push_subscriptions").delete().eq("id", id);
}

async function sendToSubscription(subRow, payload) {
  const pushSub = {
    endpoint: subRow.endpoint,
    keys: { p256dh: subRow.p256dh, auth: subRow.auth },
  };
  await webpush.sendNotification(pushSub, JSON.stringify(payload), {
    TTL: 86_400,
    urgency: "normal",
  });
}

/**
 * @param {object} opts
 * @param {string[]} opts.userIds
 * @param {string} [opts.excludeUserId]
 * @param {'task_assigned'|'meeting_assigned'|'task_update'|'meeting_update'} opts.category
 * @param {string} opts.title
 * @param {string} opts.body
 * @param {Record<string,string>} [opts.data]
 */
async function notifyUsers(opts) {
  if (!isPushConfigured()) return;
  const { userIds, excludeUserId, category, title, body, data } = opts;
  const unique = [...new Set((userIds || []).filter(Boolean))].filter((id) => id !== excludeUserId);
  if (!unique.length) return;

  const payload = {
    title: String(title || "TaskFlow"),
    body: String(body || ""),
    data: { url: "/", ...(data || {}) },
  };

  for (const uid of unique) {
    let prefs;
    try {
      prefs = await getOrCreatePreferences(uid);
    } catch {
      continue;
    }
    if (!prefAllows(prefs, category)) continue;

    let subs = [];
    try {
      subs = await fetchSubscriptionsForUser(uid);
    } catch {
      continue;
    }
    for (const sub of subs) {
      try {
        await sendToSubscription(sub, payload);
      } catch (err) {
        const status = err?.statusCode;
        if (status === 404 || status === 410) {
          await deleteSubscriptionRow(sub.id);
        }
      }
    }
  }
}

async function getActorDisplayName(actorId) {
  if (!actorId) return "Someone";
  const { data } = await supabase.from("profiles").select("full_name, email").eq("id", actorId).maybeSingle();
  if (!data) return "Someone";
  const name = (data.full_name || "").trim();
  return name || data.email || "Someone";
}

module.exports = {
  isPushConfigured,
  getOrCreatePreferences,
  updatePreferences,
  saveSubscription,
  removeSubscription,
  notifyUsers,
  getActorDisplayName,
  DEFAULT_PREFS,
};
