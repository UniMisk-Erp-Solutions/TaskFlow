const router = require("express").Router();
const auth = require("../middleware/authMiddleware");
const ctrl = require("../controllers/notificationController");

router.get("/vapid-public-key", auth, ctrl.getVapidPublicKey);
router.get("/preferences", auth, ctrl.getPreferences);
router.patch("/preferences", auth, ctrl.patchPreferences);
router.post("/subscribe", auth, ctrl.subscribe);
router.post("/unsubscribe", auth, ctrl.unsubscribe);

module.exports = router;
