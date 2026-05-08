const supabase = require("../config/supabase");
const axios = require("axios");

exports.handleAIQuery = async (req, res) => {
  try {
    const question = req.body.question;

    if (!question) {
      return res.status(400).json({ error: "Question is required" });
    }

    // STEP 1 — Intent classification (cheap model)
    const intentRes = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: process.env.OPENROUTER_MODEL,
        messages: [
          {
            role: "system",
            content:
              "Classify intent: pending_today, overdue, blocked, all_tasks, unknown"
          },
          { role: "user", content: question }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`
        }
      }
    );

    const intent =
      intentRes.data.choices[0].message.content.trim().toLowerCase();

    // STEP 2 — Fetch data (cost-free logic)
    let query = supabase.from("tasks").select("*");

    const today = new Date().toISOString().split("T")[0];

    if (intent.includes("pending_today")) {
      query = query.eq("status", "pending").eq("due_date", today);
    } else if (intent.includes("overdue")) {
      query = query.lt("due_date", today).neq("status", "completed");
    } else if (intent.includes("blocked")) {
      query = query.eq("status", "blocked");
    }

    const { data, error } = await query;

    if (error) throw error;

    // STEP 3 — Generate answer (expensive → minimized)
    const answerRes = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: process.env.OPENROUTER_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are a task assistant. Answer ONLY using provided data. Keep it short."
          },
          {
            role: "user",
            content: `Question: ${question}\nData: ${JSON.stringify(data)}`
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`
        }
      }
    );

    const answer = answerRes.data.choices[0].message.content;

    res.json({ intent, answer, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
