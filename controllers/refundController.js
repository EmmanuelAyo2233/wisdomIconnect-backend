const { RefundRequest, Payment, User, AdminLog, Notification } = require('../models');

exports.requestRefund = async (req, res) => {
  try {
    const userId = req.user.id;
    const { paymentId, reason } = req.body;
    
    if (!paymentId || !reason) return res.status(400).json({ message: "paymentId and reason are required" });

    const payment = await Payment.findByPk(paymentId);
    if (!payment) return res.status(404).json({ message: "Payment not found" });

    // Check if already requested
    const existing = await RefundRequest.findOne({ where: { paymentId } });
    if (existing) return res.status(400).json({ message: "Refund already requested for this payment" });

    const refund = await RefundRequest.create({ userId, paymentId, reason });

    const adminUsers = await User.findAll({ where: { userType: 'admin' } });
    if (adminUsers.length > 0) {
        const adminNotifs = adminUsers.map(a => ({
            receiverId: a.id,
            receiverType: 'admin',
            senderId: userId,
            message: `New Refund Request submitted for payment #${paymentId}.`,
            type: "system",
            link: "/admin/refunds"
        }));
        await Notification.bulkCreate(adminNotifs);
    }

    res.status(201).json({ message: "Refund requested successfully", data: refund });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getAllRefunds = async (req, res) => {
  try {
    const refunds = await RefundRequest.findAll({
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'email'] },
        { model: Payment, as: 'payment' }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json({ data: refunds });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.updateRefundStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNote } = req.body;
    const adminId = req.user.id;

    const refund = await RefundRequest.findByPk(id);
    if (!refund) return res.status(404).json({ message: "Refund request not found" });

    refund.status = status;
    if (adminNote) refund.adminNote = adminNote;
    await refund.save();

    await AdminLog.create({
       adminId,
       action: `REFUND_${status.toUpperCase()}`,
       targetId: id.toString(),
       details: adminNote || ''
    });

    res.json({ message: `Refund ${status} successfully` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
