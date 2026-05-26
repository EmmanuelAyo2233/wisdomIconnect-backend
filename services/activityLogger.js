const { Activity } = require("../models");

/**
 * Log a platform activity securely to the database
 * @param {Object} params
 * @param {string} params.type - "BOOKING" | "PAYMENT" | "SESSION" | "USER" | "SYSTEM"
 * @param {string} params.message - Short readable message
 * @param {number} [params.userId] - ID of user involved
 * @param {string} [params.targetId] - ID of target entity (optional)
 * @param {string} [params.status] - "success" | "pending" | "failed" (default: "success")
 * @param {Object} [params.metadata] - Optional extra info
 */
const logActivity = async ({ type, message, userId, targetId, status = "success", metadata = null }) => {
  try {
    const activity = await Activity.create({
      type,
      message,
      userId,
      targetId: targetId ? String(targetId) : null,
      status,
      metadata: metadata ? (typeof metadata === 'object' ? metadata : { raw: metadata }) : null
    });
    console.log(`[ACTIVITY LOG] [${type}] [${status}] ${message}`);
    return activity;
  } catch (error) {
    console.error("Failed to log activity:", error);
    // Silent fail so we don't break key platform processes
    return null;
  }
};

module.exports = { logActivity };
