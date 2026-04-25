const router = require("express").Router();
const auth = require("../middleware/authMiddleware");
const { signup, getMe } = require("../controllers/authController");

router.post("/signup", signup);
router.get("/me", auth, getMe);

module.exports = router;
