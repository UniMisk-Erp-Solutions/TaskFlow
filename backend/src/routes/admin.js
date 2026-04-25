const router = require("express").Router();
const auth = require("../middleware/authMiddleware");
const admin = require("../middleware/adminMiddleware");
const { getDashboardStats } = require("../controllers/taskController");
const { sendReminders } = require("../controllers/emailController");

router.get("/dashboard", auth, admin, getDashboardStats);
router.post("/send-reminders", auth, admin, sendReminders);

module.exports = router;
