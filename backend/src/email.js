const router = require("express").Router();
const auth = require("../middleware/authMiddleware");
const { sendReminders } = require("../controllers/emailController");

router.post("/send-reminders", auth, sendReminders);

module.exports = router;
