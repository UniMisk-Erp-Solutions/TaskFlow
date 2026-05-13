const router = require("express").Router();
const auth = require("../middleware/authMiddleware");
const admin = require("../middleware/adminMiddleware");
const ctrl = require("../controllers/meetingController");
const attach = require("../controllers/meetingAttachmentController");
const multer = require("multer");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB

router.get("/", auth, ctrl.getMeetings);
router.post("/", auth, ctrl.createMeeting);
router.patch("/:id/status", auth, ctrl.updateStatus);
router.get("/attachments/:attachmentId/download", auth, attach.download);
router.get("/:id/attachments", auth, attach.list);
router.post("/:id/attachments", auth, admin, upload.single("file"), attach.upload);
router.get("/:id", auth, ctrl.getMeetingById);
router.patch("/:id", auth, ctrl.patchMeeting);
router.delete("/:id", auth, admin, ctrl.deleteMeeting);

module.exports = router;
