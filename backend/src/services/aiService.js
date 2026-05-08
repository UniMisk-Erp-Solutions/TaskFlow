const axios = require("axios");

exports.generateEmail = async (task, user) => {
  const prompt = `Write a short professional reminder email.

Task: ${task.title}
Due: ${task.due_date}
Employee: ${user.full_name}
Status: ${task.status}

Tone: friendly but urgent.`;

  const response = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model: process.env.OPENROUTER_MODEL,
      messages: [{ role: "user", content: prompt }]
    },
    { headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` } }
  );

  return response.data.choices[0].message.content;
};
