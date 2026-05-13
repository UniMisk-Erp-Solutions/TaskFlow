const router = require("express").Router();
const auth = require("../middleware/authMiddleware");
const admin = require("../middleware/adminMiddleware");
const { getDashboardStats } = require("../controllers/taskController");
const { getOverviewStats } = require("../controllers/adminStatsController");
const { sendReminders } = require("../controllers/emailController");
const { listUsers, createUser } = require("../controllers/adminUserController");

router.get("/dashboard", auth, admin, getDashboardStats);
router.get("/overview-stats", auth, admin, getOverviewStats);
router.post("/send-reminders", auth, admin, sendReminders);

// User management (org-scoped)
router.get("/users", auth, admin, listUsers);
router.post("/users", auth, admin, createUser);

module.exports = router;
