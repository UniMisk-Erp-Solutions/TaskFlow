const supabase = require("../config/supabase");

exports.getTasks = async (req, res) => {
  const userId = req.user.sub;

  const { data, error } = await supabase
    .from("tasks")
    .select("*");

  if (error) return res.status(400).json(error);

  res.json(data);
};

exports.createTask = async (req, res) => {
  const { title, description, assignee_id, priority, due_date } = req.body;

  const { data, error } = await supabase
    .from("tasks")
    .insert([
      {
        title,
        description,
        assignee_id,
        priority,
        due_date,
        status: "pending",
        created_by: req.user.sub
      }
    ]);

  if (error) return res.status(400).json(error);

  res.json(data);
};

exports.updateStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const { data, error } = await supabase
    .from("tasks")
    .update({ status, updated_at: new Date() })
    .eq("id", id);

  if (error) return res.status(400).json(error);

  res.json(data);
};

exports.deleteTask = async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", id);

  if (error) return res.status(400).json(error);

  res.json({ message: "Deleted" });
};
