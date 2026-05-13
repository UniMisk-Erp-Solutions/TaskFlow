const supabase = require("../config/supabase");
const {
  loadOrgRoleById,
  filterMappedTasksForAdmin,
  adminCanSeeAssigneeScopedOrgItem,
  mapTaskRowQuick,
} = require("../utils/orgVisibility");

const VALID_PRIORITIES = ["low", "medium", "high"];
const VALID_STATUSES = ["pending", "in_progress", "completed", "blocked"];

async function profilesInOrg(orgId, ids) {
  const unique = [...new Set((ids || []).filter(Boolean))];
  if (!unique.length) return [];
  const { data, error } = await supabase.from("profiles").select("id, role").eq("org_id", orgId).in("id", unique);
  if (error) throw new Error(error.message);
  return data || [];
}

async function fetchTaskAssigneeIds(taskId) {
  const { data } = await supabase.from("task_assignees").select("profile_id").eq("task_id", taskId);
  return (data || []).map((r) => r.profile_id);
}

function mapTaskRow(row, assigneeIdsOverride) {
  if (!row) return null;
  const fromJunction = assigneeIdsOverride
    ? assigneeIdsOverride
    : (row.task_assignees || []).map((t) => t.profile_id).filter(Boolean);
  const assignee_ids = fromJunction.length
    ? [...new Set(fromJunction)]
    : row.assignee_id
      ? [row.assignee_id]
      : [];
  const rest = { ...row };
  delete rest.task_assignees;
  return {
    ...rest,
    assignee_ids,
  };
}

async function employeeCanAccessTask(userId, task) {
  if (!task) return false;
  if (task.assignee_id === userId) return true;
  const ids = await fetchTaskAssigneeIds(task.id);
  return ids.includes(userId);
}

async function replaceTaskAssignees(taskId, profileIds, bumpUpdated = true) {
  const unique = [...new Set((profileIds || []).filter(Boolean))];
  await supabase.from("task_assignees").delete().eq("task_id", taskId);
  if (unique.length) {
    const { error } = await supabase.from("task_assignees").insert(
      unique.map((profile_id) => ({ task_id: taskId, profile_id }))
    );
    if (error) throw new Error(error.message);
  }
  if (bumpUpdated) {
    await supabase.from("tasks").update({ updated_at: new Date().toISOString() }).eq("id", taskId);
  }
}

async function loadTaskForUser(req, id) {
  const { data: row, error } = await supabase
    .from("tasks")
    .select("*, task_assignees(profile_id)")
    .eq("id", id)
    .eq("org_id", req.user.org_id)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!row) return { error: "not_found" };

  const mapped = mapTaskRow(row);

  if (req.user.role !== "admin") {
    const ok = await employeeCanAccessTask(req.user.id, row);
    if (!ok) return { error: "forbidden" };
    return { task: mapped };
  }

  try {
    const roleById = await loadOrgRoleById(req.user.org_id);
    if (!adminCanSeeAssigneeScopedOrgItem(mapped, req.user.id, roleById)) {
      return { error: "forbidden" };
    }
  } catch (e) {
    return { error: e.message };
  }

  return { task: mapped };
}

exports.getTasks = async (req, res) => {
  try {
    let query = supabase
      .from("tasks")
      .select("*, task_assignees(profile_id)")
      .eq("org_id", req.user.org_id);

    if (req.user.role !== "admin") {
      const { data: links } = await supabase
        .from("task_assignees")
        .select("task_id")
        .eq("profile_id", req.user.id);

      const linkIds = [...new Set((links || []).map((l) => l.task_id).filter(Boolean))];
      if (linkIds.length) {
        query = query.or(`assignee_id.eq.${req.user.id},id.in.(${linkIds.join(",")})`);
      } else {
        query = query.eq("assignee_id", req.user.id);
      }
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) return res.status(400).json({ error: error.message });

    let list = (data || []).map((row) => mapTaskRow(row));

    if (req.user.role === "admin") {
      try {
        const roleById = await loadOrgRoleById(req.user.org_id);
        list = filterMappedTasksForAdmin(list, req.user.id, roleById);
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }

    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getTaskById = async (req, res) => {
  try {
    const { id } = req.params;
    const r = await loadTaskForUser(req, id);
    if (r.error === "not_found" || r.error === "forbidden") {
      return res.status(r.error === "forbidden" ? 403 : 404).json({ error: "Task not found or access denied" });
    }
    if (r.error) return res.status(400).json({ error: r.error });

    const { data: subRows } = await supabase
      .from("tasks")
      .select("id, title, status, due_date, priority, parent_task_id, assignee_id, created_by, task_assignees(profile_id)")
      .eq("org_id", req.user.org_id)
      .eq("parent_task_id", id)
      .order("created_at", { ascending: true });

    const subsMapped = (subRows || []).map((s) => mapTaskRow(s));

    if (req.user.role !== "admin") {
      const filtered = subsMapped.filter((s) => employeeSeesMappedRow(req.user.id, s));
      const slim = filtered.map(({ id: sid, title, status, due_date, priority, parent_task_id }) => ({
        id: sid,
        title,
        status,
        due_date,
        priority,
        parent_task_id,
      }));
      return res.json({ ...r.task, subtasks: slim });
    }

    try {
      const roleById = await loadOrgRoleById(req.user.org_id);
      const filtered = filterMappedTasksForAdmin(subsMapped, req.user.id, roleById);
      const slim = filtered.map(({ id: sid, title, status, due_date, priority, parent_task_id }) => ({
        id: sid,
        title,
        status,
        due_date,
        priority,
        parent_task_id,
      }));
      res.json({ ...r.task, subtasks: slim });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

async function validateParentTask(req, parentTaskId, orgId) {
  if (!parentTaskId) return { ok: true };
  const { data: parent } = await supabase
    .from("tasks")
    .select("id, org_id")
    .eq("id", parentTaskId)
    .maybeSingle();

  if (!parent || parent.org_id !== orgId) {
    return { ok: false, message: "Invalid parent task" };
  }

  if (req.user.role === "admin") return { ok: true };

  const { data: prow } = await supabase
    .from("tasks")
    .select("id, assignee_id, org_id")
    .eq("id", parentTaskId)
    .maybeSingle();

  const can = await employeeCanAccessTask(req.user.id, prow);
  if (!can) return { ok: false, message: "You can only add subtasks to tasks you are assigned to" };

  return { ok: true };
}

exports.createTask = async (req, res) => {
  try {
    let {
      title,
      description,
      assignee_id,
      assignee_ids,
      priority,
      due_date,
      project_id,
      parent_task_id,
    } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({ error: "Title is required" });
    }

    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: `Priority must be one of: ${VALID_PRIORITIES.join(", ")}` });
    }

    const ids = assignee_ids?.length ? assignee_ids : assignee_id ? [assignee_id] : [];
    if (!ids.length) {
      return res.status(400).json({ error: "At least one assignee is required" });
    }

    const validated = await profilesInOrg(req.user.org_id, ids);
    if (validated.length !== [...new Set(ids)].length) {
      return res.status(400).json({ error: "One or more assignees are not in your workspace" });
    }

    const parentCheck = await validateParentTask(req, parent_task_id, req.user.org_id);
    if (!parentCheck.ok) {
      return res.status(400).json({ error: parentCheck.message });
    }

    if (project_id) {
      const { data: proj } = await supabase
        .from("projects")
        .select("id")
        .eq("id", project_id)
        .eq("org_id", req.user.org_id)
        .maybeSingle();
      if (!proj) return res.status(400).json({ error: "Invalid project" });
    }

    const primaryAssignee = ids[0];

    const insertRow = {
      title: title.trim(),
      description,
      assignee_id: primaryAssignee,
      priority: priority || "medium",
      due_date: due_date || null,
      status: "pending",
      created_by: req.user.id,
      org_id: req.user.org_id,
      project_id: project_id || null,
      parent_task_id: parent_task_id || null,
    };

    const { data: created, error } = await supabase.from("tasks").insert([insertRow]).select().single();

    if (error) return res.status(400).json({ error: error.message });

    try {
      await replaceTaskAssignees(created.id, ids, true);
    } catch (syncErr) {
      await supabase.from("tasks").delete().eq("id", created.id);
      return res.status(400).json({ error: syncErr.message });
    }

    const { data: fresh } = await supabase
      .from("tasks")
      .select("*, task_assignees(profile_id)")
      .eq("id", created.id)
      .single();

    res.status(201).json(mapTaskRow(fresh));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.patchTask = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      priority,
      due_date,
      project_id,
      assignee_ids,
      parent_task_id,
    } = req.body;

    const r = await loadTaskForUser(req, id);
    if (r.error === "not_found" || r.error === "forbidden") {
      return res.status(r.error === "forbidden" ? 403 : 404).json({ error: "Task not found or access denied" });
    }
    if (r.error) return res.status(400).json({ error: r.error });

    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: `Priority must be one of: ${VALID_PRIORITIES.join(", ")}` });
    }

    if (parent_task_id !== undefined && parent_task_id !== null) {
      const parentCheck = await validateParentTask(req, parent_task_id, req.user.org_id);
      if (!parentCheck.ok) return res.status(400).json({ error: parentCheck.message });
      if (parent_task_id === id) {
        return res.status(400).json({ error: "Task cannot be its own parent" });
      }
    }

    if (assignee_ids !== undefined) {
      const ids = assignee_ids || [];
      if (!ids.length) {
        return res.status(400).json({ error: "At least one assignee is required" });
      }
      const validated = await profilesInOrg(req.user.org_id, ids);
      if (validated.length !== [...new Set(ids)].length) {
        return res.status(400).json({ error: "One or more assignees are not in your workspace" });
      }
    }

    if (project_id !== undefined && project_id !== null && project_id !== "") {
      const { data: proj } = await supabase
        .from("projects")
        .select("id")
        .eq("id", project_id)
        .eq("org_id", req.user.org_id)
        .maybeSingle();
      if (!proj) return res.status(400).json({ error: "Invalid project" });
    }

    const updates = { updated_at: new Date().toISOString() };

    if (title !== undefined) {
      if (!String(title).trim()) return res.status(400).json({ error: "Title is required" });
      updates.title = String(title).trim();
    }
    if (description !== undefined) updates.description = description;
    if (priority !== undefined) updates.priority = priority;
    if (due_date !== undefined) updates.due_date = due_date || null;
    if (project_id !== undefined) updates.project_id = project_id || null;
    if (parent_task_id !== undefined) updates.parent_task_id = parent_task_id || null;

    const { data: updated, error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", id)
      .eq("org_id", req.user.org_id)
      .select()
      .maybeSingle();

    if (error) return res.status(400).json({ error: error.message });
    if (!updated) return res.status(404).json({ error: "Task not found" });

    if (assignee_ids !== undefined) {
      const ids = assignee_ids || [];
      const primary = ids[0];
      await supabase.from("tasks").update({ assignee_id: primary, updated_at: new Date().toISOString() }).eq("id", id);
      await replaceTaskAssignees(id, ids, true);
    }

    const { data: fresh } = await supabase
      .from("tasks")
      .select("*, task_assignees(profile_id)")
      .eq("id", id)
      .single();

    res.json(mapTaskRow(fresh));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) return res.status(400).json({ error: "Status is required" });
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${VALID_STATUSES.join(", ")}` });
    }

    const access = await loadTaskForUser(req, id);
    if (access.error === "not_found" || access.error === "forbidden") {
      return res.status(access.error === "forbidden" ? 403 : 404).json({ error: "Task not found or access denied" });
    }
    if (access.error) return res.status(400).json({ error: access.error });

    const { data, error } = await supabase
      .from("tasks")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("org_id", req.user.org_id)
      .select("*, task_assignees(profile_id)")
      .maybeSingle();

    if (error) return res.status(400).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "Task not found or access denied" });

    res.json(mapTaskRow(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteTask = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { id } = req.params;

    const { data: row, error: fetchErr } = await supabase
      .from("tasks")
      .select("id, created_by, assignee_id, task_assignees(profile_id)")
      .eq("id", id)
      .eq("org_id", req.user.org_id)
      .maybeSingle();

    if (fetchErr) return res.status(400).json({ error: fetchErr.message });
    if (!row) return res.status(404).json({ error: "Task not found" });

    const mapped = mapTaskRow(row);
    const roleById = await loadOrgRoleById(req.user.org_id);
    if (!adminCanSeeAssigneeScopedOrgItem(mapped, req.user.id, roleById)) {
      return res.status(404).json({ error: "Task not found or access denied" });
    }

    const { error } = await supabase.from("tasks").delete().eq("id", id).eq("org_id", req.user.org_id);
    if (error) return res.status(400).json({ error: error.message });

    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    const { data: taskRows, error } = await supabase
      .from("tasks")
      .select("id, status, due_date, created_by, assignee_id, task_assignees(profile_id)")
      .eq("org_id", req.user.org_id);

    if (error) throw error;

    const roleById = await loadOrgRoleById(req.user.org_id);
    const tasks = filterMappedTasksForAdmin((taskRows || []).map(mapTaskRowQuick), req.user.id, roleById);

    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === "completed").length;
    const overdue = tasks.filter((t) => t.due_date && t.due_date < today && t.status !== "completed").length;
    const pending = tasks.filter((t) => t.status === "pending").length;
    const in_progress = tasks.filter((t) => t.status === "in_progress").length;
    const blocked = tasks.filter((t) => t.status === "blocked").length;

    res.json({ total, completed, overdue, pending, in_progress, blocked });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
