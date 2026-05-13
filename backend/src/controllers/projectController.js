const supabase = require("../config/supabase");
const {
  loadOrgRoleById,
  filterMappedTasksForAdmin,
  employeeSeesMappedRow,
  mapTaskRowQuick,
} = require("../utils/orgVisibility");

exports.listProjects = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("org_id", req.user.org_id)
      .order("name", { ascending: true });

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
