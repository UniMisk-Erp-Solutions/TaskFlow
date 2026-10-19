const router = require("express").Router();
const auth = require("../middleware/authMiddleware");
const { proxyAssistant } = require("../controllers/aiController");

router.use(auth, proxyAssistant);

module.exports = router;
