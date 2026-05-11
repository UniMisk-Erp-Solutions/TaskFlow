import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

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

async function requireAuth(req: Request) {
  const user = await getAuthUser(req);
  if (!user) return { error: json({ error: "Unauthorized" }, 401) };
  return { user };
}

function requireAdmin(user: AppUser) {
  if (user.role !== "admin") return json({ error: "Admin access required" }, 403);
  return null;
}

function meetingCanBeAccessedBy(user: AppUser, meeting: any) {
  if (!meeting) return false;
  if (meeting.org_id !== user.org_id) return false;
  if (user.role === "admin") return true;
  return meeting.assignee_id === user.id;
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

  const { data: loginData } = await supabase.auth.signInWithPassword({ email, password });
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

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
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
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("org_id", user.org_id)
    .order("full_name");
  if (error) return json({ error: error.message }, 500);
  return json(data ?? []);
}

async function handleTasks(req: Request, path: string) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  if (req.method === "GET" && path === "/tasks") {
    let q = supabase.from("tasks").select("*").eq("org_id", user.org_id);
    if (user.role !== "admin") q = q.eq("assignee_id", user.id);
    const { data, error } = await q;
    if (error) return json({ error: error.message }, 400);
    return json(data ?? []);
  }

  if (req.method === "POST" && path === "/tasks") {
    const adminErr = requireAdmin(user);
    if (adminErr) return adminErr;
    const body = await parseBody(req);
    const { title, description, assignee_id, priority, due_date } = body as any;
    if (!title?.trim()) return json({ error: "Title is required" }, 400);
    const { data, error } = await supabase
      .from("tasks")
      .insert([{
        title: title.trim(),
        description,
        assignee_id,
        priority: priority || "medium",
        due_date,
        status: "pending",
        created_by: user.id,
        org_id: user.org_id,
      }])
      .select()
      .single();
    if (error) return json({ error: error.message }, 400);
    return json(data, 201);
  }

  const statusMatch = path.match(/^\/tasks\/([^/]+)\/status$/);
  if (req.method === "PATCH" && statusMatch) {
    const id = statusMatch[1];
    const body = await parseBody(req);
    const status = (body as any).status;
    if (!status) return json({ error: "Status is required" }, 400);
    let q = supabase
      .from("tasks")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("org_id", user.org_id);
    if (user.role !== "admin") q = q.eq("assignee_id", user.id);
    const { data, error } = await q.select().maybeSingle();
    if (error) return json({ error: error.message }, 400);
    if (!data) return json({ error: "Task not found or access denied" }, 404);
    return json(data);
  }

  const delMatch = path.match(/^\/tasks\/([^/]+)$/);
  if (req.method === "DELETE" && delMatch) {
    const adminErr = requireAdmin(user);
    if (adminErr) return adminErr;
    const id = delMatch[1];
    const { error } = await supabase.from("tasks").delete().eq("id", id).eq("org_id", user.org_id);
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
    let q = supabase.from("meetings").select("*").eq("org_id", user.org_id);
    if (user.role !== "admin") q = q.eq("assignee_id", user.id);
    const { data, error } = await q;
    if (error) return json({ error: error.message }, 400);
    return json(data ?? []);
  }

  if (req.method === "POST" && path === "/meetings") {
    const adminErr = requireAdmin(user);
    if (adminErr) return adminErr;
    const body = await parseBody(req);
    const { title, description, assignee_id, priority, meeting_date, meeting_time } = body as any;
    if (!title?.trim()) return json({ error: "Title is required" }, 400);
    if (!meeting_date) return json({ error: "Meeting date is required" }, 400);
    if (!meeting_time) return json({ error: "Meeting time is required" }, 400);
    const { data, error } = await supabase
      .from("meetings")
      .insert([{
        title: title.trim(),
        description,
        assignee_id,
        priority: priority || "medium",
        meeting_date,
        meeting_time,
        status: "scheduled",
        created_by: user.id,
        org_id: user.org_id,
      }])
      .select()
      .single();
    if (error) return json({ error: error.message }, 400);
    return json(data, 201);
  }

  const statusMatch = path.match(/^\/meetings\/([^/]+)\/status$/);
  if (req.method === "PATCH" && statusMatch) {
    const id = statusMatch[1];
    const body = await parseBody(req);
    const status = (body as any).status;
    if (!status) return json({ error: "Status is required" }, 400);
    let q = supabase
      .from("meetings")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("org_id", user.org_id);
    if (user.role !== "admin") q = q.eq("assignee_id", user.id);
    const { data, error } = await q.select().maybeSingle();
    if (error) return json({ error: error.message }, 400);
    if (!data) return json({ error: "Meeting not found or access denied" }, 404);
    return json(data);
  }

  const delMatch = path.match(/^\/meetings\/([^/]+)$/);
  if (req.method === "DELETE" && delMatch) {
    const adminErr = requireAdmin(user);
    if (adminErr) return adminErr;
    const id = delMatch[1];
    const { error } = await supabase.from("meetings").delete().eq("id", id).eq("org_id", user.org_id);
    if (error) return json({ error: error.message }, 400);
    return json({ message: "Deleted" });
  }

  // Attachments list
  const listMatch = path.match(/^\/meetings\/([^/]+)\/attachments$/);
  if (req.method === "GET" && listMatch) {
    const id = listMatch[1];
    const { data: meeting } = await supabase
      .from("meetings")
      .select("id, org_id, assignee_id")
      .eq("id", id)
      .eq("org_id", user.org_id)
      .maybeSingle();
    if (!meetingCanBeAccessedBy(user, meeting)) return json({ error: "Meeting not found or access denied" }, 404);

    const { data, error } = await supabase
      .from("meeting_attachments")
      .select("id, type, original_name, content_type, size_bytes, created_at")
      .eq("org_id", user.org_id)
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
    const { data: meeting } = await supabase
      .from("meetings")
      .select("id, org_id, assignee_id")
      .eq("id", id)
      .eq("org_id", user.org_id)
      .maybeSingle();
    if (!meeting) return json({ error: "Meeting not found or access denied" }, 404);

    const form = await req.formData();
    const type = String(form.get("type") || "other");
    const file = form.get("file");
    if (!(file instanceof File)) return json({ error: "File is required" }, 400);

    const safeName = file.name.replace(/[^\w.\-() ]+/g, "_");
    const pathKey = `${user.org_id}/${id}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
    const fileBuf = new Uint8Array(await file.arrayBuffer());

    const { error: upErr } = await supabase.storage
      .from("meeting-assets")
      .upload(pathKey, fileBuf, { contentType: file.type || "application/octet-stream", upsert: false });
    if (upErr) return json({ error: upErr.message }, 400);

    const { data: row, error: insErr } = await supabase
      .from("meeting_attachments")
      .insert([{
        org_id: user.org_id,
        meeting_id: id,
        assignee_id: meeting.assignee_id,
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
      .eq("org_id", user.org_id)
      .maybeSingle();
    if (error) return json({ error: error.message }, 400);
    if (!att) return json({ error: "Attachment not found" }, 404);
    if (user.role !== "admin" && att.assignee_id !== user.id) return json({ error: "Access denied" }, 403);

    const { data: signed, error: sErr } = await supabase.storage.from(att.bucket).createSignedUrl(att.path, 600);
    if (sErr) return json({ error: sErr.message }, 400);
    return Response.redirect(signed.signedUrl, 302);
  }

  return null;
}

async function handleAdmin(req: Request, path: string) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;
  const adminErr = requireAdmin(user);
  if (adminErr) return adminErr;

  if (req.method === "GET" && path === "/admin/dashboard") {
    const today = new Date().toISOString().split("T")[0];
    const { data: tasks, error } = await supabase
      .from("tasks")
      .select("id, status, due_date")
      .eq("org_id", user.org_id);
    if (error) return json({ error: error.message }, 500);
    const total = tasks?.length ?? 0;
    const completed = (tasks ?? []).filter((t: any) => t.status === "completed").length;
    const overdue = (tasks ?? []).filter((t: any) => t.due_date && t.due_date < today && t.status !== "completed").length;
    const pending = (tasks ?? []).filter((t: any) => t.status === "pending").length;
    const in_progress = (tasks ?? []).filter((t: any) => t.status === "in_progress").length;
    const blocked = (tasks ?? []).filter((t: any) => t.status === "blocked").length;
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
        return json(
          { error: "User created but profile linking failed", detail: upErr.message },
          500,
        );
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const path = stripApiPrefix(new URL(req.url).pathname);

    if (req.method === "GET" && path === "/") return json({ ok: true, service: "edge-api" });

    // Auth routes
    if (req.method === "POST" && path === "/auth/signup") return await handleAuthSignup(req);
    if (req.method === "POST" && path === "/auth/login") return await handleAuthLogin(req);
    if (req.method === "GET" && path === "/auth/me") return await handleAuthMe(req);
    if (req.method === "GET" && path === "/auth/profiles") return await handleAuthProfiles(req);

    const tasksResp = await handleTasks(req, path);
    if (tasksResp) return tasksResp;

    const meetingsResp = await handleMeetings(req, path);
    if (meetingsResp) return meetingsResp;

    const adminResp = await handleAdmin(req, path);
    if (adminResp) return adminResp;

    return json({ error: "Not found" }, 404);
  } catch (err) {
    return json({ error: err?.message || "Internal server error" }, 500);
  }
});

