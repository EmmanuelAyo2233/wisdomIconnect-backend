const express = require("express");
const router = express.Router();
const {
    joinWaitlist,
    getWaitlist,
    getWaitlistStats,
    updateWaitlistStatus,
    deleteWaitlistEntry,
} = require("../controllers/waitlistController");
const { authentication, restrictTo } = require("../controllers/authcontrollers");

// ── Public route (no auth required)
router.post("/", joinWaitlist);

// ── Admin-only routes
router.use(authentication);
router.use(restrictTo("admin"));

router.get("/", getWaitlist);
router.get("/stats", getWaitlistStats);
router.patch("/:id/status", updateWaitlistStatus);
router.delete("/:id", deleteWaitlistEntry);

module.exports = router;
