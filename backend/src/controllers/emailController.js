const supabase = require("../config/supabase");
const { generateEmail } = require("../services/aiService");
const { sendEmail } = require("../services/emailService");

exports.sendReminders = async (req, res) => {
  try {
    console.log('sendReminders - Starting reminder process...');
    
    // Check environment variables
    if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) {
      console.error('sendReminders - Missing email configuration:', {
        hasApiKey: !!process.env.BREVO_API_KEY,
        hasSenderEmail: !!process.env.BREVO_SENDER_EMAIL
      });
      return res.status(500).json({ error: "Email service not configured" });
    }

    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select("*")
      .neq("status", "completed");

    if (tasksError) throw tasksError;

    console.log('sendReminders - Found tasks:', tasks.length);
    
    const now = new Date();
    const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    let count = 0;
    const errors = [];

    for (const task of tasks) {
      if (!task.assignee_id || !task.due_date) {
        console.log(`sendReminders - Skipping task ${task.id}: missing assignee or due_date`);
        continue;
      }

      const due = new Date(task.due_date);
      if (due > next24h) {
        console.log(`sendReminders - Skipping task ${task.id}: due date ${task.due_date} is beyond 24h`);
        continue;
      }

      console.log(`sendReminders - Processing task ${task.id}: ${task.title} due ${task.due_date}`);

      const { data: user, error: userError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", task.assignee_id)
        .single();

      if (userError || !user || !user.email) {
        console.log(`sendReminders - No profile/email for assignee ${task.assignee_id} (task: ${task.id})`);
        errors.push(`No profile/email for assignee ${task.assignee_id} (task: ${task.id})`);
        continue;
      }

      try {
        console.log(`sendReminders - Generating email for ${user.email}`);
        const emailContent = await generateEmail(task, user);
        
        console.log(`sendReminders - Sending email to ${user.email}`);
        await sendEmail(user.email, "Task Reminder", emailContent);

        await supabase.from("email_logs").insert([{
          task_id: task.id,
          recipient_email: user.email,
          type: "reminder",
          content: emailContent,
          sent_at: new Date().toISOString()
        }]);

        console.log(`sendReminders - Successfully sent reminder for task ${task.id}`);
        count++;
      } catch (sendErr) {
        console.error(`sendReminders - Failed to send reminder for task ${task.id}:`, sendErr);
        errors.push(`Failed to send reminder for task ${task.id}: ${sendErr.message}`);
      }
    }

    res.json({ sent: count, errors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
