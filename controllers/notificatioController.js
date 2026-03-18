const Mentor = require("../models/mentor"); // make sure to import your Mentor model
const Mentee = require("../models/mentee"); // make sure to import your Mentee model
const Appointment = require("../models/appointment"); // make sure to import your Appointment model
const Notification = require("../models/notification");

exports.getNotifications = async (req, res) => {
  try {
    // 🔒 Check if user is authenticated
    if (!req.user || !req.user.userType) {
      return res.status(401).json({
        status: "fail",
        message: "Unauthorized: user not found ❌",
      });
    }

    const userType = req.user.userType.toLowerCase(); // normalize
    let receiverId = null;

    // 🔹 Use preloaded mentorId / menteeId from authentication
    if (userType === "mentor") {
      if (!req.user.mentorId) {
        return res.status(404).json({
          status: "fail",
          message: "Mentor profile not found ❌",
        });
      }
      receiverId = req.user.mentorId;
    } else if (userType === "mentee") {
      if (!req.user.menteeId) {
        return res.status(404).json({
          status: "fail",
          message: "Mentee profile not found ❌",
        });
      }
      receiverId = req.user.menteeId;
    } else {
      return res.status(400).json({
        status: "fail",
        message: `Invalid userType: ${req.user.userType} ❌`,
      });
    }

    // 🔹 Fetch notifications for this user only
    const notifications = await Notification.findAll({
      where: {
        receiverId,
        receiverType: userType,
      },
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      status: "success",
      data: notifications,
    });
  } catch (err) {
    console.error("❌ getNotifications error:", err);

    res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};


exports.markAllAsRead = async (req, res) => {
  try {
    if (!req.user || !req.user.userType) {
      return res.status(401).json({
        status: "fail",
        message: "Unauthorized ❌",
      });
    }

    const userType = req.user.userType.toLowerCase();
    let receiverId;

    if (userType === "mentor") {
      receiverId = req.user.mentorId;
    } else if (userType === "mentee") {
      receiverId = req.user.menteeId;
    } else {
      return res.status(400).json({
        status: "fail",
        message: "Invalid user type ❌",
      });
    }

    await Notification.update(
      { isRead: true },
      {
        where: {
          receiverId,
          receiverType: userType,
          isRead: false,
        },
      }
    );

    res.status(200).json({
      status: "success",
      message: "All notifications marked as read ✅",
    });
  } catch (err) {
    console.error("❌ markAllAsRead error:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to mark all as read ❌",
    });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    if (!req.user || !req.user.userType) {
      return res.status(401).json({ message: "Unauthorized ❌" });
    }

    const userType = req.user.userType.toLowerCase();
    let receiverId;

    if (userType === "mentor") {
      receiverId = req.user.mentorId;
    } else if (userType === "mentee") {
      receiverId = req.user.menteeId;
    }

    const notif = await Notification.findOne({
      where: {
        id: req.params.id,
        receiverId,
        receiverType: userType,
      },
    });

    if (!notif) {
      return res.status(404).json({
        message: "Notification not found ❌",
      });
    }

    notif.isRead = true;
    await notif.save();

    res.json({
      status: "success",
      message: "Notification marked as read ✅",
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "Failed to update notification ❌",
    });
  }
};
