const router = require("express").Router();
const auth = require("../middleware/authMiddleware");
const ctrl = require("../controllers/taskController");

router.get("/", auth, ctrl.getTasks);
router.post("/", auth, ctrl.createTask);
router.patch("/:id/status", auth, ctrl.updateStatus);
router.delete("/:id", auth, ctrl.deleteTask);

module.exports = router;
