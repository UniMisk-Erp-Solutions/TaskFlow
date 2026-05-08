const supabase = require("../config/supabase");

const VALID_PRIORITIES = ["low", "medium", "high"];
const VALID_STATUSES = ["scheduled", "completed", "cancelled"];

exports.getMeetings = async (req, res) => {
  try {
    let query = supabase
      .from("meetings")
      .select("*")
      .eq("org_id", req.user.org_id);

    // Admins see all meetings; employees see only meetings assigned to them
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

exports.createMeeting = async (req, res) => {
  try {
    const { title, description, assignee_id, priority, meeting_date, meeting_time } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({ error: "Title is required" });
    }
    if (!meeting_date) {
      return res.status(400).json({ error: "Meeting date is required" });
    }
    if (!meeting_time) {
      return res.status(400).json({ error: "Meeting time is required" });
    }
    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: `Priority must be one of: ${VALID_PRIORITIES.join(", ")}` });
    }

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
      .from("meetings")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("org_id", req.user.org_id);

    // Non-admins can only update meetings assigned to them
    if (req.user.role !== "admin") {
      query = query.eq("assignee_id", req.user.id);
    }

    const { data, error } = await query.select().maybeSingle();
    if (error) return res.status(400).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "Meeting not found or access denied" });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteMeeting = async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase.from("meetings").delete().eq("id", id);
    if (error) return res.status(400).json({ error: error.message });

    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
