const supabase = require("../config/supabase");
const { generateEmail } = require("../services/aiService");
const { sendEmail } = require("../services/emailService");

exports.sendReminders = async (req, res) => {
  try {
    const now = new Date();
    const next24 = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const { data: tasks } = await supabase
      .from("tasks")
      .select("*")
      .neq("status", "completed");

    let count = 0;

    for (const task of tasks) {
      if (new Date(task.due_date) <= next24) {
        const { data: user } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", task.assignee_id)
          .single();

        const emailContent = await generateEmail(task, user);

        await sendEmail(user.email, "Task Reminder", emailContent);

        await supabase.from("email_logs").insert([
          {
            task_id: task.id,
            recipient_email: user.email,
            type: "reminder",
            content: emailContent,
            sent_at: new Date()
          }
        ]);

        count++;
      }
    }

    res.json({ message: `${count} reminders sent` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
