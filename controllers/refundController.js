const { RefundRequest, Payment, User, AdminLog, Notification, Appointment, Mentor, Mentee, Wallet } = require('../models');
const paystackService = require('../services/paystackService');
const { logActivity } = require('../services/activityLogger');

exports.requestRefund = async (req, res) => {
  try {
    const userId = req.user.id;
    const { appointmentId, reasonType, reason, evidenceUrl } = req.body;
    
    if (!appointmentId || !reason) {
      return res.status(400).json({ success: false, message: "appointmentId and justification reason are required" });
    }

    const appointment = await Appointment.findByPk(appointmentId, {
      include: [
        { model: Mentee, as: 'mentee' },
        { model: Mentor, as: 'mentor' }
      ]
    });
    if (!appointment) return res.status(404).json({ success: false, message: "Session not found ❌" });

    // Validate that the requester is the mentee who paid
    if (appointment.mentee.user_id !== userId) {
      return res.status(403).json({ success: false, message: "Unauthorized: only the booking mentee can request a refund ❌" });
    }

    // Only paid sessions are eligible
    if (appointment.sessionType !== 'paid') {
      return res.status(400).json({ success: false, message: "Refunds only apply to paid sessions ❌" });
    }

    const payment = await Payment.findOne({ where: { appointmentId } });
    if (!payment) return res.status(404).json({ success: false, message: "Payment records not found for this session ❌" });

    if (payment.status === 'refunded' || payment.status === 'released') {
      return res.status(400).json({ success: false, message: `Cannot request refund. Escrow is already ${payment.status} ❌` });
    }

    // Prevent duplicate request
    const existing = await RefundRequest.findOne({ where: { appointmentId } });
    if (existing) return res.status(400).json({ success: false, message: "Refund request already exists for this session ❌" });

    // Step 2: Automatic Validation Engine
    let autoApprove = false;
    let autoApproveReason = "";

    // A. Mentor never joined
    if (appointment.mentorJoinTime === null) {
      autoApprove = true;
      autoApproveReason = "Mentor never joined the session";
    }
    // B. Session cancelled
    else if (appointment.status === 'cancelled') {
      autoApprove = true;
      autoApproveReason = "Session was cancelled";
    }

    let refundStatus = 'pending';
    let refundRef = null;

    if (autoApprove) {
      console.log(`[AUTO-APPROVE REFUND] Criteria matched: ${autoApproveReason}. Ref: ${payment.reference}`);
      const refundRes = await paystackService.processRefund(payment.reference);
      if (refundRes.success) {
        refundStatus = 'approved';
        refundRef = refundRes.data.reference;

        payment.status = 'refunded';
        payment.escrow_status = 'refunded';
        payment.refund_reference = refundRef;
        payment.refundedAt = new Date();
        payment.refundReason = `Auto-approved: ${autoApproveReason}`;
        await payment.save();

        appointment.refund_status = 'refunded';
        appointment.completion_status = 'cancelled';
        await appointment.save();
      } else {
        refundStatus = 'pending'; // Fallback to manual if API failed
        appointment.refund_status = 'failed';
        await appointment.save();
      }
    }

    const refund = await RefundRequest.create({
      userId,
      paymentId: payment.id,
      appointmentId,
      mentorId: appointment.mentorId,
      reasonType: reasonType || 'other',
      reason,
      evidenceUrl: evidenceUrl || null,
      status: refundStatus,
      adminNote: autoApprove ? `Auto-approved: ${autoApproveReason}` : null
    });

    // Notify users
    const menteeUser = await User.findByPk(userId);

    if (autoApprove && refundStatus === 'approved') {
      // In-app & Email: Mentee
      await Notification.create({
        receiverId: appointment.menteeId,
        receiverType: 'mentee',
        title: "Refund Approved",
        message: `✅ Your refund request for Session #${appointmentId} was approved automatically.`,
        type: "payment"
      });
      // In-app: Mentor
      await Notification.create({
        receiverId: appointment.mentorId,
        receiverType: 'mentor',
        title: "Session Refunded",
        message: `💸 A refund has been issued to the mentee for Session #${appointmentId}.`,
        type: "payment"
      });
    } else {
      // Alert Admins
      const adminUsers = await User.findAll({ where: { userType: 'admin' } });
      if (adminUsers.length > 0) {
        const adminNotifs = adminUsers.map(a => ({
          receiverId: a.id,
          receiverType: 'admin',
          senderId: userId,
          message: `New Refund Request submitted for session #${appointmentId} by ${menteeUser.name}.`,
          type: "system",
          link: "/admin/refunds"
        }));
        await Notification.bulkCreate(adminNotifs);
      }
    }

    logActivity({
      type: "PAYMENT",
      message: `Refund request submitted for Session #${appointmentId} (${refundStatus})`,
      userId,
      targetId: refund.id,
      status: refundStatus === 'pending' ? 'pending' : 'success'
    });

    res.status(201).json({
      success: true,
      message: refundStatus === 'approved' ? "Refund auto-approved and processed successfully ✅" : "Refund request submitted for administrator review",
      data: refund
    });

  } catch (error) {
    console.error("requestRefund Error:", error);
    res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
};

exports.getAllRefunds = async (req, res) => {
  try {
    const refunds = await RefundRequest.findAll({
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'email'] },
        { 
          model: Appointment, 
          as: 'appointment',
          attributes: ['id', 'date', 'startTime', 'endTime', 'status', 'mentorJoinTime', 'menteeJoinTime', 'duration', 'mentor_reason', 'mentee_reason']
        },
        { model: Payment, as: 'payment' }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json({ success: true, data: refunds });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

exports.updateRefundStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNote } = req.body;
    const adminId = req.user.id;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status option. Must be 'approved' or 'rejected'" });
    }

    const refund = await RefundRequest.findByPk(id, {
      include: [
        { model: Payment, as: 'payment' },
        { model: Appointment, as: 'appointment', include: [{ model: Mentor, as: 'mentor' }] }
      ]
    });
    if (!refund) return res.status(404).json({ success: false, message: "Refund request not found ❌" });

    if (refund.status !== 'pending') {
      return res.status(400).json({ success: false, message: `This request has already been processed with status: ${refund.status}` });
    }

    const payment = refund.payment;
    const appointment = refund.appointment;

    if (status === 'approved') {
      if (!payment) return res.status(404).json({ success: false, message: "Payment details missing for this request" });

      console.log(`[ADMIN REFUND APPROVE] Executing Paystack Refund for payment ref: ${payment.reference}`);
      const refundRes = await paystackService.processRefund(payment.reference);
      if (!refundRes.success) {
        payment.status = 'disputed';
        appointment.refund_status = 'failed';
        await Promise.all([payment.save(), appointment.save()]);
        return res.status(500).json({ success: false, message: `Paystack API Refund failed: ${refundRes.message}` });
      }

      // Update state
      payment.status = 'refunded';
      payment.escrow_status = 'refunded';
      payment.refund_reference = refundRes.data.reference;
      payment.refundedAt = new Date();
      payment.refundReason = adminNote || "Approved by administrator";
      await payment.save();

      appointment.refund_status = 'refunded';
      appointment.completion_status = 'cancelled';
      appointment.status = 'cancelled';
      await appointment.save();

      // Deduct from Mentor wallet if funds were pending/released
      const mentorUserId = appointment.mentor.user_id;
      const mentorWallet = await Wallet.findOne({ where: { userId: mentorUserId } });
      if (mentorWallet) {
        mentorWallet.pendingBalance = Math.max(0, mentorWallet.pendingBalance - payment.mentorShare);
        await mentorWallet.save();
        console.log(`[WALLET ADJUST] Deducted ₦${payment.mentorShare} from Mentor ${mentorUserId} pending wallet`);
      }

      // Deduct from Admin wallet
      const adminWallet = await Wallet.findOne({ where: { userId: adminId } });
      if (adminWallet) {
        adminWallet.pendingBalance = Math.max(0, adminWallet.pendingBalance - payment.platformShare);
        await adminWallet.save();
      }

      refund.status = 'approved';
      if (adminNote) refund.adminNote = adminNote;
      await refund.save();

      // Notify Mentee
      await Notification.create({
        receiverId: refund.userId,
        receiverType: 'mentee',
        title: "Refund Approved",
        message: `✅ Your refund of ₦${payment.amount.toLocaleString()} was approved and processed by the admin.`,
        type: "payment"
      });

      // Notify Mentor
      await Notification.create({
        receiverId: appointment.mentorId,
        receiverType: 'mentor',
        title: "Refund Issued",
        message: `💸 The administrator approved a refund for Session #${appointment.id}. ₦${payment.mentorShare.toLocaleString()} was deducted from your pending balance.`,
        type: "payment"
      });

    } else if (status === 'rejected') {
      appointment.refund_status = 'none';
      await appointment.save();

      refund.status = 'rejected';
      if (adminNote) refund.adminNote = adminNote;
      await refund.save();

      // Notify Mentee
      await Notification.create({
        receiverId: refund.userId,
        receiverType: 'mentee',
        title: "Refund Declined",
        message: `❌ Your refund request for Session #${appointment.id} was declined by the admin.`,
        type: "payment"
      });
    }

    await AdminLog.create({
       adminId,
       action: `REFUND_${status.toUpperCase()}`,
       targetId: id.toString(),
       details: adminNote || ''
    });

    logActivity({
      type: "PAYMENT",
      message: `Admin ${status} refund request #${id} for Session #${appointment.id}`,
      userId: adminId,
      targetId: id,
      status: 'success'
    });

    res.json({ success: true, message: `Refund request successfully ${status} ✅` });

  } catch (error) {
    console.error("updateRefundStatus Error:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};
