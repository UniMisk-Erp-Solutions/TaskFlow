const supabase = require("../config/supabase");
const axios = require("axios");

exports.handleAIQuery = async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: "Question is required" });

    // Check environment variables
    if (!process.env.OPENROUTER_API_KEY || !process.env.OPENROUTER_MODEL) {
      console.error("Missing OpenRouter configuration:", {
        hasKey: !!process.env.OPENROUTER_API_KEY,
        hasModel: !!process.env.OPENROUTER_MODEL,
        model: process.env.OPENROUTER_MODEL
      });
      return res.status(500).json({ 
        error: "AI service not configured properly. Missing API key or model." 
      });
    }

    // Fetch all tasks with assignee name — admin sees all, employee sees own
    let query = supabase
      .from("tasks")
      .select("*, assignee:profiles!assignee_id(full_name, email)");

    if (req.user.role !== "admin") {
      query = query.eq("assignee_id", req.user.id);
    }

    const { data: tasks, error } = await query;
    if (error) throw error;

    const today = new Date().toISOString().split("T")[0];

    // Build a clean summary so the AI has context without raw UUIDs
    const summary = tasks.map((t) => ({
      title:    t.title,
      assignee: t.assignee?.full_name || t.assignee?.email || "Unassigned",
      status:   t.status,
      priority: t.priority,
      due_date: t.due_date || null,
      overdue:  t.due_date && t.due_date < today && t.status !== "completed",
    }));

    const systemPrompt = `You are an AI assistant embedded in a company task management tool.
Today's date is ${today}.
You have access to the full task list below. Answer the user's question accurately and concisely.
Use employee names (not IDs) in your answers.
If asked for stats, calculate them from the data.
If no data matches the question, say so clearly.
Do not make up information not present in the data.`;

    console.log("Making AI request with model:", process.env.OPENROUTER_MODEL);

    const { data: aiRes } = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: process.env.OPENROUTER_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Task data:\n${JSON.stringify(summary, null, 2)}\n\nQuestion: ${question}`,
          },
        ],
      },
      { 
        headers: { 
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        } 
      }
    );

    if (!aiRes.choices || aiRes.choices.length === 0) {
      throw new Error("No response from AI service");
    }

    res.json({ answer: aiRes.choices[0].message.content, taskCount: tasks.length });
  } catch (err) {
    console.error("AI Query Error:", {
      message: err.message,
      stack: err.stack,
      response: err.response?.data,
      env: {
        hasKey: !!process.env.OPENROUTER_API_KEY,
        hasModel: !!process.env.OPENROUTER_MODEL,
        model: process.env.OPENROUTER_MODEL
      }
    });
    res.status(500).json({ 
      error: err.response?.data?.error?.message || err.message || "AI service failed" 
    });
  }
};
