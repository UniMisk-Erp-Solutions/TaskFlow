const router = require("express").Router();
const auth = require("../middleware/authMiddleware");
const ctrl = require("../controllers/projectController");

router.get("/", auth, ctrl.listProjects);
router.post("/", auth, ctrl.createProject);
router.get("/:id/progress", auth, ctrl.getProgress);

module.exports = router;
