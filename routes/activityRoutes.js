const express = require("express");
const router = express.Router();
const { authentication } = require("../controllers/authcontrollers");
const Activity = require("../models/activity");

// POST /activity/log - Exposes HTTP endpoint for internal/system logging
router.post("/log", authentication, async (req, res) => {
  try {
    const { type, message, targetId, status = "success", metadata = null } = req.body;
    
    // Validate activity type
    const validTypes = ["BOOKING", "PAYMENT", "SESSION", "USER", "SYSTEM"];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ success: false, message: "Invalid activity type" });
    }

    const activity = await Activity.create({
      type,
      message,
      userId: req.user ? req.user.id : null,
      targetId: targetId ? String(targetId) : null,
      status,
      metadata: metadata ? (typeof metadata === 'object' ? metadata : { raw: metadata }) : null
    });

    console.log(`[ACTIVITY LOG HTTP] [${type}] [${status}] ${message}`);

    return res.status(201).json({ success: true, activity });
  } catch (error) {
    console.error("Error in activity log HTTP endpoint:", error);
    res.status(500).json({ success: false, message: "Server error logging activity", error: error.message });
  }
});

module.exports = router;
