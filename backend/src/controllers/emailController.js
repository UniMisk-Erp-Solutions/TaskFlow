const supabase = require("../config/supabase");
const { generateEmail } = require("../services/aiService");
const { sendEmail } = require("../services/emailService");

exports.sendReminders = async (req, res) => {
  try {
    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select("*")
      .neq("status", "completed");

    if (tasksError) throw tasksError;

    const now = new Date();
    const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    let count = 0;
    const errors = [];

    for (const task of tasks) {
      if (!task.assignee_id || !task.due_date) continue;

      const due = new Date(task.due_date);
      if (due > next24h) continue;

      const { data: user, error: userError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", task.assignee_id)
        .single();

      if (userError || !user || !user.email) {
        errors.push(`No profile/email for assignee ${task.assignee_id} (task: ${task.id})`);
        continue;
      }

      try {
        const emailContent = await generateEmail(task, user);
        await sendEmail(user.email, "Task Reminder", emailContent);

        await supabase.from("email_logs").insert([{
          task_id: task.id,
          recipient_email: user.email,
          type: "reminder",
          content: emailContent,
          sent_at: new Date().toISOString()
        }]);

        count++;
      } catch (sendErr) {
        errors.push(`Failed to send reminder for task ${task.id}: ${sendErr.message}`);
      }
    }

    res.json({ sent: count, errors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
