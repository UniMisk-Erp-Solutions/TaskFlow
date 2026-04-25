const router = require("express").Router();
const auth = require("../middleware/authMiddleware");
const { signup, getMe, testConnection } = require("../controllers/authController");

router.get("/test", testConnection);
router.post("/signup", signup);
router.get("/me", auth, getMe);

module.exports = router;
