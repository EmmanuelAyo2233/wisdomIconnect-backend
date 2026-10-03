const express = require("express");
const router = express.Router();
const { authentication } = require("../controllers/authcontrollers");
const Activity = require("../models/activity");

// POST /activity/log - Exposes HTTP endpoint for internal/system logging
router.post("/log", authentication, async (req, res) => {
  try {
    const message = typeof req.body.message === "string" ? req.body.message.slice(0,500) : "Client activity";
    const type = "USER", targetId = null, status = "success", metadata = {source:"client_telemetry"};
    
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
    require('../utils/logger').error("Error in activity log HTTP endpoint:", error);
    res.status(500).json({ success: false, message: "Server error logging activity", error: error.message });
  }
});

module.exports = router;
