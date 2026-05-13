const router = require("express").Router();
const auth = require("../middleware/authMiddleware");
const admin = require("../middleware/adminMiddleware");
const ctrl = require("../controllers/taskController");

router.get("/", auth, ctrl.getTasks);
router.post("/", auth, ctrl.createTask);
router.patch("/:id/status", auth, ctrl.updateStatus);
router.get("/:id", auth, ctrl.getTaskById);
router.patch("/:id", auth, ctrl.patchTask);
router.delete("/:id", auth, admin, ctrl.deleteTask);

module.exports = router;
