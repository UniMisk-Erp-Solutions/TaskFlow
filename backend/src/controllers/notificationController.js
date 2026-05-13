const webPush = require("../services/webPushService");

exports.getVapidPublicKey = async (req, res) => {
  try {
    const key = process.env.VAPID_PUBLIC_KEY;
    if (!key) {
      return res.status(503).json({ error: "Push notifications are not configured on this server (missing VAPID keys)." });
    }
    res.json({ publicKey: key });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getPreferences = async (req, res) => {
  try {
    const prefs = await webPush.getOrCreatePreferences(req.user.id);
    res.json(prefs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.patchPreferences = async (req, res) => {
  try {
    const updated = await webPush.updatePreferences(req.user.id, req.body || {});
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.subscribe = async (req, res) => {
  try {
    if (!webPush.isPushConfigured()) {
      return res.status(503).json({ error: "Push notifications are not configured on this server." });
    }
    const sub = req.body;
    if (!sub || !sub.endpoint) {
      return res.status(400).json({ error: "Subscription object with endpoint and keys is required" });
    }
    await webPush.saveSubscription(req.user.id, sub, req.headers["user-agent"]);
    const prefs = await webPush.updatePreferences(req.user.id, { push_enabled: true });
    res.status(201).json({ ok: true, preferences: prefs });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.unsubscribe = async (req, res) => {
  try {
    const supabaseClient = require("../config/supabase");
    const endpoint = req.body?.endpoint;
    if (endpoint) {
      await webPush.removeSubscription(req.user.id, endpoint);
    } else {
      await supabaseClient.from("push_subscriptions").delete().eq("user_id", req.user.id);
    }
    let prefs = await webPush.getOrCreatePreferences(req.user.id);
    const { count } = await supabaseClient
      .from("push_subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", req.user.id);
    const remaining = count ?? 0;
    if (remaining === 0) {
      prefs = await webPush.updatePreferences(req.user.id, { push_enabled: false });
    }
    res.json({ ok: true, preferences: prefs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
