const {
  HttpError,
  positiveId,
  text,
  respondError,
} = require("../utils/security");
const {
  RefundRequest,
  Payment,
  User,
  AdminLog,
  Notification,
  Appointment,
  Mentor,
  Mentee,
  Wallet,
} = require("../models");
const paystackService = require("../services/paystackService");
const { logActivity } = require("../services/activityLogger");

exports.requestRefund = async (req, res) => {
  try {
    const refund = await require("../models").db.sequelize.transaction(
      async (transaction) => {
        const appointment = await Appointment.findByPk(
          positiveId(req.body.appointmentId),
          { transaction, lock: transaction.LOCK.UPDATE },
        );
        await require("../services/authorizationService").appointmentFor(
          req.user,
          appointment,
        );
        if (
          req.user.userType !== "mentee" ||
          appointment.sessionType !== "paid"
        )
          throw new HttpError(
            403,
            "Only the paying mentee can request a refund",
          );
        const payment = await Payment.findOne({
          where: { appointmentId: appointment.id },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (
          !payment ||
          !["pending", "awaiting_acceptance", "disputed"].includes(
            payment.status,
          ) ||
          payment.refundState !== "none"
        )
          throw new HttpError(409, "Payment is not eligible for refund review");
        const existing = await RefundRequest.findOne({
          where: { appointmentId: appointment.id },
          transaction,
        });
        if (existing) return existing;
        const reasonType = req.body.reasonType || "other";
        if (
          ![
            "no_show",
            "technical",
            "cancelled",
            "misconduct",
            "duration",
            "other",
          ].includes(reasonType)
        )
          throw new HttpError(400, "Invalid refund reason");
        const refund = await RefundRequest.create(
          {
            userId: req.user.id,
            paymentId: payment.id,
            appointmentId: appointment.id,
            mentorId: appointment.mentorId,
            reasonType,
            reason: text(req.body.reason, "Reason", 5000),
            status: "pending",
          },
          { transaction },
        );
        await appointment.update(
          {
            status: "under_review",
            completion_status: "disputed",
            refund_status: "pending",
          },
          { transaction },
        );
        await payment.update(
          { status: "disputed", escrow_status: "disputed" },
          { transaction },
        );
        return refund;
      },
    );
    res
      .status(201)
      .json({
        success: true,
        data: refund,
        message: "Refund submitted for admin review. Funds remain held.",
      });
  } catch (error) {
    respondError(res, error);
  }
};

exports.getAllRefunds = async (req, res) => {
  try {
    const refunds = await RefundRequest.findAll({
      include: [
        { model: User, as: "user", attributes: ["id", "name", "email"] },
        {
          model: Appointment,
          as: "appointment",
          attributes: [
            "id",
            "date",
            "startTime",
            "endTime",
            "status",
            "mentorJoinTime",
            "menteeJoinTime",
            "duration",
            "mentor_reason",
            "mentee_reason",
          ],
        },
        { model: Payment, as: "payment" },
      ],
      order: [["createdAt", "DESC"]],
    });
    res.json({ success: true, data: refunds });
  } catch (error) {
    require('../utils/logger').error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.updateRefundStatus = async (req, res) => {
  try {
    if (req.user.userType !== "admin")
      throw new HttpError(403, "Admin required");
    if (!["approved", "rejected"].includes(req.body.status))
      throw new HttpError(400, "Invalid decision");
    const refund = await RefundRequest.findByPk(positiveId(req.params.id));
    if (!refund) throw new HttpError(404, "Refund request not found");
    if (refund.status !== "pending")
      throw new HttpError(409, "Request already reviewed");
    if (req.body.status === "approved")
      await require("../services/financeService").requestRefund(
        refund.appointmentId,
        req.user,
        text(req.body.adminNote || "Admin approved refund", "Note", 500),
        true,
      );
    await refund.update({
      status: req.body.status,
      adminNote: text(req.body.adminNote || "", "Note", 500, false),
    });
    res.json({
      success: true,
      message:
        "Decision recorded; approved refunds await provider confirmation",
    });
  } catch (error) {
    respondError(res, error);
  }
};
