const supabase = require("../config/supabase");
const {
  loadOrgRoleById,
  filterMappedTasksForAdmin,
  employeeSeesMappedRow,
  mapTaskRowQuick,
} = require("../utils/orgVisibility");

exports.listProjects = async (req, res) => {
  try {
    let query = supabase
      .from("projects")
      .select("*")
      .eq("org_id", req.user.org_id)
      .order("name", { ascending: true });

    if (req.user.role !== "admin") {
      // Employees only see projects they are assigned to through tasks or meetings.
      const uid = req.user.id;
      const orgId = req.user.org_id;
      const [taskLinks, meetingLinks, legacyTasks, legacyMeetings] = await Promise.all([
        supabase.from("task_assignees").select("task_id").eq("profile_id", uid),
        supabase.from("meeting_assignees").select("meeting_id").eq("profile_id", uid),
        supabase.from("tasks").select("project_id").eq("org_id", orgId).eq("assignee_id", uid).not("project_id", "is", null),
        supabase.from("meetings").select("project_id").eq("org_id", orgId).eq("assignee_id", uid).not("project_id", "is", null),
      ]);
      const taskIds = (taskLinks.data || []).map((r) => r.task_id);
      const meetingIds = (meetingLinks.data || []).map((r) => r.meeting_id);
      const [linkedTasks, linkedMeetings] = await Promise.all([
        taskIds.length ? supabase.from("tasks").select("project_id").eq("org_id", orgId).in("id", taskIds).not("project_id", "is", null) : { data: [] },
        meetingIds.length ? supabase.from("meetings").select("project_id").eq("org_id", orgId).in("id", meetingIds).not("project_id", "is", null) : { data: [] },
      ]);
      const projectIds = [...new Set([
        ...(legacyTasks.data || []), ...(legacyMeetings.data || []), ...(linkedTasks.data || []), ...(linkedMeetings.data || []),
      ].map((r) => r.project_id).filter(Boolean))];
      if (!projectIds.length) return res.json([]);
      query = query.in("id", projectIds);
    }

    const { data, error } = await query;
    if (error) return res.status(400).json({ error: error.message });
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createProject = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { name, description } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ error: "Name is required" });
    }

    const { data, error } = await supabase
      .from("projects")
      .insert([
        {
          org_id: req.user.org_id,
          name: name.trim(),
          description: description?.trim() || null,
          created_by: req.user.id,
        },
      ])
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getProgress = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: project, error: pErr } = await supabase
      .from("projects")
      .select("id")
      .eq("id", id)
      .eq("org_id", req.user.org_id)
      .maybeSingle();

    if (pErr) return res.status(400).json({ error: pErr.message });
    if (!project) return res.status(404).json({ error: "Project not found" });

    const { data: taskRows, error: tErr } = await supabase
      .from("tasks")
      .select("id, status, created_by, assignee_id, task_assignees(profile_id)")
      .eq("project_id", id)
      .eq("org_id", req.user.org_id);

    if (tErr) return res.status(400).json({ error: tErr.message });

    const mappedList = (taskRows || []).map(mapTaskRowQuick);

    let list = mappedList;
    if (req.user.role === "admin") {
      try {
        const roleById = await loadOrgRoleById(req.user.org_id);
        list = filterMappedTasksForAdmin(mappedList, req.user.id, roleById);
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    } else {
      list = mappedList.filter((t) => employeeSeesMappedRow(req.user.id, t));
    }

    const total = list.length;
    const completed = list.filter((t) => t.status === "completed").length;
    const percent_complete = total === 0 ? 0 : Math.round((completed / total) * 100);

    res.json({ total, completed, percent_complete });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateProject = async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Admin access required" });
    const { id } = req.params;
    const patch = {};
    if (req.body && req.body.name !== undefined) {
      const name = String(req.body.name || "").trim();
      if (!name) return res.status(400).json({ error: "Project name is required" });
      patch.name = name;
    }
    if (req.body && req.body.description !== undefined) patch.description = String(req.body.description || "").trim() || null;
    if (!Object.keys(patch).length) return res.status(400).json({ error: "Nothing to update" });
    const { data, error } = await supabase.from("projects").update(patch)
      .eq("id", id).eq("org_id", req.user.org_id).select().maybeSingle();
    if (error) return res.status(400).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "Project not found" });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteProject = async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Admin access required" });
    const { id } = req.params;
    const { data: existing } = await supabase.from("projects").select("id").eq("id", id).eq("org_id", req.user.org_id).maybeSingle();
    if (!existing) return res.status(404).json({ error: "Project not found" });
    // Tasks and meetings stay; they only lose the project link.
    const unlinkTasks = await supabase.from("tasks").update({ project_id: null }).eq("project_id", id).eq("org_id", req.user.org_id);
    if (unlinkTasks.error) return res.status(400).json({ error: unlinkTasks.error.message });
    const unlinkMeetings = await supabase.from("meetings").update({ project_id: null }).eq("project_id", id).eq("org_id", req.user.org_id);
    if (unlinkMeetings.error) return res.status(400).json({ error: unlinkMeetings.error.message });
    const { error } = await supabase.from("projects").delete().eq("id", id).eq("org_id", req.user.org_id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
