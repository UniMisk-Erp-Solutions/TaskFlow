const supabase = require("../config/supabase");

const VALID_PRIORITIES = ["low", "medium", "high"];
const VALID_STATUSES = ["pending", "in_progress", "completed", "blocked"];

exports.getTasks = async (req, res) => {
  try {
    let query = supabase
      .from("tasks")
      .select("*")
      .eq("org_id", req.user.org_id);

    // Admins see all tasks; employees see only tasks assigned to them
    if (req.user.role !== "admin") {
      query = query.eq("assignee_id", req.user.id);
    }

    const { data, error } = await query;
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createTask = async (req, res) => {
  try {
    const { title, description, assignee_id, priority, due_date } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({ error: "Title is required" });
    }
    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: `Priority must be one of: ${VALID_PRIORITIES.join(", ")}` });
    }

    const { data, error } = await supabase
      .from("tasks")
      .insert([{
        title: title.trim(),
        description,
        assignee_id,
        priority: priority || "medium",
        due_date,
        status: "pending",
        created_by: req.user.id,
        org_id: req.user.org_id,
      }])
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(data);
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

    let query = supabase
      .from("tasks")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("org_id", req.user.org_id);

    // Non-admins can only update tasks assigned to them
    if (req.user.role !== "admin") {
      query = query.eq("assignee_id", req.user.id);
    }

    const { data, error } = await query.select().maybeSingle();
    if (error) return res.status(400).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "Task not found or access denied" });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteTask = async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) return res.status(400).json({ error: error.message });

    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    const { data: tasks, error } = await supabase
      .from("tasks")
      .select("id, status, due_date")
      .eq("org_id", req.user.org_id);

    if (error) throw error;

    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === "completed").length;
    const overdue = tasks.filter(
      (t) => t.due_date && t.due_date < today && t.status !== "completed"
    ).length;
    const pending = tasks.filter((t) => t.status === "pending").length;
    const in_progress = tasks.filter((t) => t.status === "in_progress").length;
    const blocked = tasks.filter((t) => t.status === "blocked").length;

    res.json({ total, completed, overdue, pending, in_progress, blocked });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
