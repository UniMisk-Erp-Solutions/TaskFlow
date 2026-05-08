const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

function createServiceClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const BUCKET = "meeting-assets";

async function loadMeetingOrDeny(serviceClient, req) {
  const { id } = req.params;

  const { data: meeting, error } = await serviceClient
    .from("meetings")
    .select("id, org_id, assignee_id, title")
    .eq("id", id)
    .eq("org_id", req.user.org_id)
    .maybeSingle();

  if (error) {
    return { error: { status: 400, message: error.message } };
  }
  if (!meeting) {
    return { error: { status: 404, message: "Meeting not found or access denied" } };
  }

  // Employees can only access their own meeting attachments
  if (req.user.role !== "admin" && meeting.assignee_id !== req.user.id) {
    return { error: { status: 403, message: "Access denied" } };
  }

  return { meeting };
}

exports.list = async (req, res) => {
  try {
    const serviceClient = createServiceClient();
    const { meeting, error } = await loadMeetingOrDeny(serviceClient, req);
    if (error) return res.status(error.status).json({ error: error.message });

    const { data, error: listError } = await serviceClient
      .from("meeting_attachments")
      .select("id, type, original_name, content_type, size_bytes, created_at")
      .eq("org_id", req.user.org_id)
      .eq("meeting_id", meeting.id)
      .order("created_at", { ascending: false });

    if (listError) return res.status(400).json({ error: listError.message });
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.upload = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const serviceClient = createServiceClient();
    const { meeting, error } = await loadMeetingOrDeny(serviceClient, req);
    if (error) return res.status(error.status).json({ error: error.message });

    const type = (req.body?.type || "other").toString();
    if (!["audio", "transcript", "other"].includes(type)) {
      return res.status(400).json({ error: "Invalid attachment type" });
    }

    const file = req.file;
    if (!file) return res.status(400).json({ error: "File is required" });

    const ext = (file.originalname.split(".").pop() || "").toLowerCase();
    const rand = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");
    const safeName = file.originalname.replace(/[^\w.\-() ]+/g, "_");
    const path = `${req.user.org_id}/${meeting.id}/${Date.now()}-${rand}-${safeName}`;

    const { error: uploadError } = await serviceClient.storage
      .from(BUCKET)
      .upload(path, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      return res.status(400).json({ error: uploadError.message });
    }

    const { data: row, error: insertError } = await serviceClient
      .from("meeting_attachments")
      .insert([
        {
          org_id: req.user.org_id,
          meeting_id: meeting.id,
          assignee_id: meeting.assignee_id,
          type,
          bucket: BUCKET,
          path,
          original_name: file.originalname,
          content_type: file.mimetype,
          size_bytes: file.size,
          created_by: req.user.id,
        },
      ])
      .select("id, type, original_name, content_type, size_bytes, created_at")
      .single();

    if (insertError) {
      return res.status(400).json({ error: insertError.message });
    }

    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.download = async (req, res) => {
  try {
    const serviceClient = createServiceClient();
    const { attachmentId } = req.params;

    const { data: att, error } = await serviceClient
      .from("meeting_attachments")
      .select("id, meeting_id, org_id, assignee_id, bucket, path, original_name")
      .eq("id", attachmentId)
      .eq("org_id", req.user.org_id)
      .maybeSingle();

    if (error) return res.status(400).json({ error: error.message });
    if (!att) return res.status(404).json({ error: "Attachment not found" });

    if (req.user.role !== "admin" && att.assignee_id !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    const { data: signed, error: signError } = await serviceClient.storage
      .from(att.bucket)
      .createSignedUrl(att.path, 60 * 10); // 10 minutes

    if (signError) return res.status(400).json({ error: signError.message });
    return res.redirect(302, signed.signedUrl);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

