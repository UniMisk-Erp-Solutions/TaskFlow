const router = require("express").Router();
const auth = require("../middleware/authMiddleware");
const { handleAIQuery } = require("../controllers/aiController");

router.post("/query", auth, handleAIQuery);

module.exports = router;
