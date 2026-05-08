require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./src/routes/auth");
const taskRoutes = require("./src/routes/tasks");
const meetingRoutes = require("./src/routes/meetings");
const aiRoutes = require("./src/routes/ai");
const adminRoutes = require("./src/routes/admin");

const app = express();

const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow server-to-server tools without Origin header.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("CORS: Origin not allowed"));
    },
    credentials: true,
  })
);
app.use(express.json());

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/admin", adminRoutes);

// Serve frontend static files
app.use(express.static(path.join(__dirname, "frontend/dist")));

// SPA fallback - serve index.html for any non-API routes
app.get(/^(?!\/api).*$/, (req, res) => {
  res.sendFile(path.join(__dirname, "frontend/dist/index.html"));
});

app.get("/", (req, res) => res.send("API Running..."));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
