const router = require("express").Router();
const auth = require("../middleware/authMiddleware");
const { signup, login, getMe, updateMe, getProfiles, testConnection } = require("../controllers/authController");

router.get("/test", testConnection);
router.post("/signup", signup);
router.post("/login", login);
router.get("/me", auth, getMe);
router.patch("/me", auth, updateMe);
router.get("/profiles", auth, getProfiles);

module.exports = router;
