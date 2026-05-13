const supabase = require("../config/supabase");

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

    const { data: tasks, error: tErr } = await supabase
      .from("tasks")
      .select("id, status")
      .eq("project_id", id)
      .eq("org_id", req.user.org_id);

    if (tErr) return res.status(400).json({ error: tErr.message });

    const list = tasks || [];
    const total = list.length;
    const completed = list.filter((t) => t.status === "completed").length;
    const percent_complete = total === 0 ? 0 : Math.round((completed / total) * 100);

    res.json({ total, completed, percent_complete });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
