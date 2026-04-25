require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./src/routes/auth");
const taskRoutes = require("./src/routes/tasks");
const aiRoutes = require("./src/routes/ai");
const adminRoutes = require("./src/routes/admin");

const app = express();

app.use(cors());
app.use(express.json());

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);
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
