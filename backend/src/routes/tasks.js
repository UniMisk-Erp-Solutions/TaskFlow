const router = require("express").Router();
const auth = require("../middleware/authMiddleware");
const admin = require("../middleware/adminMiddleware");
const ctrl = require("../controllers/taskController");

router.get("/", auth, ctrl.getTasks);
router.get("/timer-analytics", auth, ctrl.getTimerAnalytics);
router.post("/", auth, ctrl.createTask);
router.post("/:id/timer/start", auth, ctrl.startTaskTimer);
router.post("/:id/timer/pause", auth, ctrl.pauseTaskTimer);
router.patch("/:id/board", auth, ctrl.updateBoardPosition);
router.patch("/:id/status", auth, ctrl.updateStatus);
router.get("/:id", auth, ctrl.getTaskById);
router.patch("/:id", auth, ctrl.patchTask);
router.delete("/:id", auth, admin, ctrl.deleteTask);

module.exports = router;
