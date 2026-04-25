const router = require("express").Router();
const auth = require("../middleware/authMiddleware");
const admin = require("../middleware/adminMiddleware");
const ctrl = require("../controllers/taskController");

router.get("/", auth, ctrl.getTasks);
router.post("/", auth, admin, ctrl.createTask);        // admin only
router.patch("/:id/status", auth, ctrl.updateStatus);
router.delete("/:id", auth, admin, ctrl.deleteTask);   // admin only

module.exports = router;
