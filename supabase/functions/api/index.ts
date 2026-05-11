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

async function requireAuth(req: Request) {
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
  let pq = supabase.from("profiles").select("id, email, full_name, role").order("full_name");
  if (user.org_id) pq = pq.eq("org_id", user.org_id);
  else pq = pq.eq("id", user.id);
  const { data, error } = await pq;
  if (error) return json({ error: error.message }, 500);
  return json(data ?? []);
}

const TASK_SELECT = "*, task_assignees(profile_id), projects(name)";
const MEETING_SELECT = "*, meeting_assignees(profile_id), projects(name)";

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
  let mq = supabase.from("meetings").select(MEETING_SELECT).eq("id", meetingId);
  if (user.org_id) mq = mq.eq("org_id", user.org_id);
  const { data: meeting } = await mq.maybeSingle();
  if (!meeting) return json({ error: "Meeting not found or access denied" }, 404);
  if (!meetingCanBeAccessedBy(user, meeting)) return json({ error: "Access denied" }, 403);
  return null;
}

async function handleTasks(req: Request, path: string) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  if (req.method === "GET" && path === "/tasks") {
    const select = TASK_SELECT;
    if (user.role === "admin") {
      let aq = supabase.from("tasks").select(select).order("created_at", { ascending: false });
      if (user.org_id) aq = aq.eq("org_id", user.org_id);
      const { data, error } = await aq;
      if (error) return json({ error: error.message }, 400);
      return json((data ?? []).map(shapeTask));
    }
    const { data: ra } = await supabase.from("task_assignees").select("task_id").eq("profile_id", user.id);
    const fromJ = [...new Set((ra ?? []).map((r: { task_id: string }) => r.task_id))];
    let legQ = supabase.from("tasks").select("id").eq("assignee_id", user.id);
    if (user.org_id) legQ = legQ.eq("org_id", user.org_id);
    const { data: leg } = await legQ;
    const fromLeg = (leg ?? []).map((r: { id: string }) => r.id);
    const allIds = [...new Set([...fromJ, ...fromLeg])];
    if (!allIds.length) return json([]);
    // IDs are already scoped to this user via assignees / legacy assignee_id — do not require org_id match
    // (null org_id on profile used to make `.eq("org_id", null)` return zero rows).
    const { data, error } = await supabase
      .from("tasks")
      .select(select)
      .in("id", allIds)
      .order("created_at", { ascending: false });
    if (error) return json({ error: error.message }, 400);
    return json((data ?? []).map(shapeTask));
  }

  const getOneTask = path.match(/^\/tasks\/([^/]+)$/);
  if (req.method === "GET" && getOneTask) {
    const id = getOneTask[1];
    const deny = await assertTaskAccess(user, id);
    if (deny) return deny;
    const { data, error } = await supabase.from("tasks").select(TASK_SELECT).eq("id", id).single();
    if (error) return json({ error: error.message }, 400);
    return json(shapeTask(data));
  }

  if (req.method === "POST" && path === "/tasks") {
    const adminErr = requireAdmin(user);
    if (adminErr) return adminErr;
    if (!user.org_id) {
      return json({ error: "Your profile has no organization; cannot create tasks." }, 400);
    }
    const body = await parseBody(req);
    const { title, description, priority, due_date, project_id } = body as any;
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
        due_date,
        status: "pending",
        created_by: user.id,
        org_id: user.org_id,
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
    const { data: full, error: fErr } = await supabase.from("tasks").select(TASK_SELECT).eq("id", task!.id).single();
    if (fErr) return json({ error: fErr.message }, 400);
    return json(shapeTask(full), 201);
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
    let uq = supabase
      .from("tasks")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (user.org_id) uq = uq.eq("org_id", user.org_id);
    const { data, error } = await uq
      .select(TASK_SELECT)
      .maybeSingle();
    if (error) return json({ error: error.message }, 400);
    if (!data) return json({ error: "Task not found or access denied" }, 404);
    return json(shapeTask(data));
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
      project_id,
    } = body as any;
    if (title !== undefined && !String(title).trim()) return json({ error: "Title cannot be empty" }, 400);
    if (project_id) {
      const { data: proj } = await supabase.from("projects").select("id").eq("id", project_id).eq("org_id", user.org_id).maybeSingle();
      if (!proj) return json({ error: "Project not found" }, 400);
    }
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (title !== undefined) patch.title = String(title).trim();
    if (description !== undefined) patch.description = description;
    if (priority !== undefined) patch.priority = priority;
    if (due_date !== undefined) patch.due_date = due_date;
    if (project_id !== undefined) patch.project_id = project_id || null;

    const assignee_ids = body.assignee_ids !== undefined || body.assigneeIds !== undefined
      ? normalizeAssigneeIds(body)
      : null;

    const { data: before } = await supabase.from("tasks").select("id").eq("id", id).single();
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

    const { data: full, error: fErr } = await supabase.from("tasks").select(TASK_SELECT).eq("id", id).single();
    if (fErr) return json({ error: fErr.message }, 400);
    return json(shapeTask(full));
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
    const select = MEETING_SELECT;
    if (user.role === "admin") {
      let aq = supabase.from("meetings").select(select).order("created_at", { ascending: false });
      if (user.org_id) aq = aq.eq("org_id", user.org_id);
      const { data, error } = await aq;
      if (error) return json({ error: error.message }, 400);
      return json((data ?? []).map(shapeMeeting));
    }
    const { data: ra } = await supabase.from("meeting_assignees").select("meeting_id").eq("profile_id", user.id);
    const fromJ = [...new Set((ra ?? []).map((r: { meeting_id: string }) => r.meeting_id))];
    let legMq = supabase.from("meetings").select("id").eq("assignee_id", user.id);
    if (user.org_id) legMq = legMq.eq("org_id", user.org_id);
    const { data: leg } = await legMq;
    const fromLeg = (leg ?? []).map((r: { id: string }) => r.id);
    const allIds = [...new Set([...fromJ, ...fromLeg])];
    if (!allIds.length) return json([]);
    const { data, error } = await supabase
      .from("meetings")
      .select(select)
      .in("id", allIds)
      .order("created_at", { ascending: false });
    if (error) return json({ error: error.message }, 400);
    return json((data ?? []).map(shapeMeeting));
  }

  const getOneMeeting = path.match(/^\/meetings\/([^/]+)$/);
  if (req.method === "GET" && getOneMeeting) {
    const id = getOneMeeting[1];
    const deny = await assertMeetingAccess(user, id);
    if (deny) return deny;
    const { data, error } = await supabase.from("meetings").select(MEETING_SELECT).eq("id", id).single();
    if (error) return json({ error: error.message }, 400);
    return json(shapeMeeting(data));
  }

  if (req.method === "POST" && path === "/meetings") {
    const adminErr = requireAdmin(user);
    if (adminErr) return adminErr;
    if (!user.org_id) {
      return json({ error: "Your profile has no organization; cannot create meetings." }, 400);
    }
    const body = await parseBody(req);
    const { title, description, priority, meeting_date, meeting_time, project_id } = body as any;
    const assignee_ids = normalizeAssigneeIds(body);
    if (!title?.trim()) return json({ error: "Title is required" }, 400);
    if (!meeting_date) return json({ error: "Meeting date is required" }, 400);
    if (!meeting_time) return json({ error: "Meeting time is required" }, 400);
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
        meeting_date,
        meeting_time,
        status: "scheduled",
        created_by: user.id,
        org_id: user.org_id,
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
    const { data: full, error: fErr } = await supabase.from("meetings").select(MEETING_SELECT).eq("id", meeting!.id).single();
    if (fErr) return json({ error: fErr.message }, 400);
    return json(shapeMeeting(full), 201);
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
    let uq = supabase
      .from("meetings")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (user.org_id) uq = uq.eq("org_id", user.org_id);
    const { data, error } = await uq
      .select(MEETING_SELECT)
      .maybeSingle();
    if (error) return json({ error: error.message }, 400);
    if (!data) return json({ error: "Meeting not found or access denied" }, 404);
    return json(shapeMeeting(data));
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
    if (title !== undefined && !String(title).trim()) return json({ error: "Title cannot be empty" }, 400);
    if (meeting_date !== undefined && meeting_date !== null && String(meeting_date).trim() === "") {
      return json({ error: "Meeting date cannot be empty" }, 400);
    }
    if (meeting_time !== undefined && meeting_time !== null && String(meeting_time).trim() === "") {
      return json({ error: "Meeting time cannot be empty" }, 400);
    }
    if (project_id) {
      const { data: proj } = await supabase.from("projects").select("id").eq("id", project_id).eq("org_id", user.org_id).maybeSingle();
      if (!proj) return json({ error: "Project not found" }, 400);
    }
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (title !== undefined) patch.title = String(title).trim();
    if (description !== undefined) patch.description = description;
    if (priority !== undefined) patch.priority = priority;
    if (meeting_date !== undefined) patch.meeting_date = meeting_date;
    if (meeting_time !== undefined) patch.meeting_time = meeting_time;
    if (project_id !== undefined) patch.project_id = project_id || null;

    const assignee_ids = body.assignee_ids !== undefined || body.assigneeIds !== undefined
      ? normalizeAssigneeIds(body)
      : null;

    const { data: before } = await supabase.from("meetings").select("id").eq("id", id).single();
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

    const { data: full, error: fErr } = await supabase.from("meetings").select(MEETING_SELECT).eq("id", id).single();
    if (fErr) return json({ error: fErr.message }, 400);
    return json(shapeMeeting(full));
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
    const { data: meeting } = await supabase
      .from("meetings")
      .select(MEETING_SELECT)
      .eq("id", id)
      .maybeSingle();
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
    const { data: meeting } = await supabase
      .from("meetings")
      .select(MEETING_SELECT)
      .eq("id", id)
      .maybeSingle();
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
    const { data: meeting } = await supabase
      .from("meetings")
      .select(MEETING_SELECT)
      .eq("id", att.meeting_id)
      .maybeSingle();
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
    const { data: tasks, error: tErr } = await supabase
      .from("tasks")
      .select("id, status, due_date")
      .eq("org_id", user.org_id);
    if (tErr) return json({ error: tErr.message }, 500);
    const { data: meetings, error: mErr } = await supabase
      .from("meetings")
      .select("id, status, meeting_date")
      .eq("org_id", user.org_id);
    if (mErr) return json({ error: mErr.message }, 500);
    const { count: userCount, error: uErr } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("org_id", user.org_id);
    if (uErr) return json({ error: uErr.message }, 500);

    const tList = tasks ?? [];
    const mList = meetings ?? [];
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

    const projectsResp = await handleProjects(req, path);
    if (projectsResp) return projectsResp;

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

