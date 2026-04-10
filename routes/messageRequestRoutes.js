const express = require("express");
const { authentication, restrictTo } = require("../controllers/authcontrollers");
const {
    sendMessageRequest,
    getMentorMessageRequests,
    respondToMessageRequest,
} = require("../controllers/messageRequestController");

const router = express.Router();

// 1. Send Message Request (Mentee only)
router.post("/send", authentication, restrictTo("mentee"), sendMessageRequest);

// 2. Get Message Requests (Mentor only)
router.get("/mentor", authentication, restrictTo("mentor"), getMentorMessageRequests);

// 3. Respond to Message Request (Mentor only)
router.put("/:requestId/respond", authentication, restrictTo("mentor"), respondToMessageRequest);

module.exports = router;
