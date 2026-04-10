const axios = require('axios');
const { Wallet, Payment, Appointment, Mentor, Mentee, User, Withdrawal } = require('../models');
const { Op } = require('sequelize');

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || 'sk_test_c869403811e92b7e632034bd5833823162354197';

// Helper to get platform admin wallet
const getPlatformAdminWallet = async () => {
    let admin = await User.findOne({ where: { userType: 'admin' } });
    if (!admin) {
        admin = await User.create({ name: "System Admin", email: "sysadmin@wisdomconnect.com", password: "N/A", userType: "admin", status: "approved" });
    }
    let wallet = await Wallet.findOne({ where: { userId: admin.id } });
    if (!wallet) wallet = await Wallet.create({ userId: admin.id });
    return wallet;
};

exports.verifyPayment = async (req, res) => {
    try {
        const { reference, appointmentId } = req.body;
        if (!reference || !appointmentId) return res.status(400).json({ success: false, message: "Reference and appointmentId are required" });

        // Verify with Paystack
        const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
            headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` }
        });
        const data = response.data.data;
        if (data.status !== "success") return res.status(400).json({ success: false, message: "Payment verification failed" });

        const existingPayment = await Payment.findOne({ where: { reference } });
        if (existingPayment) return res.status(400).json({ success: false, message: "Transaction already processed" });

        const appointment = await Appointment.findByPk(appointmentId, { include: ['mentor'] });
        if (!appointment) return res.status(404).json({ success: false, message: "Appointment not found" });

        const amountNaira = data.amount / 100;
        const mentorShare = amountNaira * 0.70;
        const platformShare = amountNaira * 0.30;

        const payment = await Payment.create({
            reference,
            amount: amountNaira,
            mentorShare,
            platformShare,
            appointmentId: appointment.id,
            status: "pending" // ESCROW
        });

        // Escrow Mentor
        const mentorUserId = appointment.mentor.user_id;
        let mentorWallet = await Wallet.findOne({ where: { userId: mentorUserId } });
        if (!mentorWallet) mentorWallet = await Wallet.create({ userId: mentorUserId });
        mentorWallet.pendingBalance += mentorShare;
        await mentorWallet.save();

        // Escrow Platform
        const adminWallet = await getPlatformAdminWallet();
        adminWallet.pendingBalance += platformShare;
        await adminWallet.save();

        res.status(200).json({ success: true, message: "Payment verified successfully", payment });
    } catch (err) {
        console.error("Payment verification error:", err.message);
        res.status(500).json({ success: false, message: "Server error during verification" });
    }
};

exports.confirmSession = async (req, res) => {
    try {
        const { appointmentId } = req.body;
        const userId = req.user.id;
        const userType = req.user.userType;

        const appointment = await Appointment.findByPk(appointmentId, { 
            include: [{ model: Mentor, as: 'mentor' }, { model: Mentee, as: 'mentee' }] 
        });
        if (!appointment) return res.status(404).json({ success: false, message: "Appointment not found" });

        if (userType === 'mentor' && appointment.mentor.user_id === userId) {
            appointment.mentorConfirmed = true;
        } else if (userType === 'mentee' && appointment.mentee.user_id === userId) {
            appointment.menteeConfirmed = true;
        } else {
            return res.status(403).json({ success: false, message: "Unauthorized to confirm this session" });
        }
        await appointment.save();

        // Check if both confirmed
        if (appointment.mentorConfirmed && appointment.menteeConfirmed) {
            appointment.status = "completed";
            await appointment.save();

            const payment = await Payment.findOne({ where: { appointmentId: appointment.id } });
            if (payment && payment.status === 'pending') {
                payment.status = "completed";
                await payment.save();

                // Release Escrow Mentor
                const mentorUserId = appointment.mentor.user_id;
                let mentorWallet = await Wallet.findOne({ where: { userId: mentorUserId } });
                mentorWallet.pendingBalance -= payment.mentorShare;
                mentorWallet.availableBalance += payment.mentorShare;
                mentorWallet.totalEarned += payment.mentorShare;
                await mentorWallet.save();

                const mentorUser = await User.findByPk(mentorUserId);
                mentorUser.sessionsCompleted += 1;
                await mentorUser.save();

                // Release Escrow Admin
                const adminWallet = await getPlatformAdminWallet();
                adminWallet.pendingBalance -= payment.platformShare;
                adminWallet.availableBalance += payment.platformShare;
                adminWallet.totalEarned += payment.platformShare;
                await adminWallet.save();
            }
        }
        res.status(200).json({ success: true, message: "Session confirmed", status: appointment.status });
    } catch (err) {
        console.error("Confirm session error:", err);
        res.status(500).json({ success: false, message: "Server error confirming session" });
    }
};

exports.requestRefund = async (req, res) => {
    try {
        const { appointmentId } = req.body;
        const userId = req.user.id;

        const appointment = await Appointment.findByPk(appointmentId, { include: ['mentee', 'mentor'] });
        if (!appointment) return res.status(404).json({ success: false, message: "Appointment not found" });

        if (appointment.mentee.user_id !== userId) return res.status(403).json({ success: false, message: "Unauthorized" });

        if (appointment.status === 'completed' || (appointment.mentorConfirmed && appointment.menteeConfirmed)) {
            return res.status(400).json({ success: false, message: "Cannot refund completed sessions." });
        }

        if (appointment.mentorConfirmed && !appointment.menteeConfirmed) {
            appointment.status = 'disputed';
            await appointment.save();
            
            const payment = await Payment.findOne({ where: { appointmentId } });
            if (payment) {
                payment.status = 'disputed';
                await payment.save();
            }
            return res.status(200).json({ success: true, message: "Session disputed. Admin will resolve." });
        }

        // Process refund
        appointment.status = 'cancelled';
        await appointment.save();

        const payment = await Payment.findOne({ where: { appointmentId } });
        if (payment && payment.status === 'pending') {
            payment.status = 'refunded';
            await payment.save();

            const mentorUserId = appointment.mentor.user_id;
            let mentorWallet = await Wallet.findOne({ where: { userId: mentorUserId } });
            if (mentorWallet) {
                 mentorWallet.pendingBalance -= payment.mentorShare;
                 if (mentorWallet.pendingBalance < 0) mentorWallet.pendingBalance = 0;
                 await mentorWallet.save();
            }

            const adminWallet = await getPlatformAdminWallet();
            adminWallet.pendingBalance -= payment.platformShare;
            if (adminWallet.pendingBalance < 0) adminWallet.pendingBalance = 0;
            await adminWallet.save();
            
            // Initiating Paystack Refund ...
        }

        res.status(200).json({ success: true, message: "Refund processed successfully." });
    } catch (err) {
        console.error("Refund error:", err);
        res.status(500).json({ success: false, message: "Server error during refund" });
    }
};

exports.withdrawFunds = async (req, res) => {
    try {
        const { amount } = req.body;
        const userId = req.user.id; 

        if (!amount || amount < 5000) return res.status(400).json({ success: false, message: "Minimum withdrawal is 5000 Naira" });

        const wallet = await Wallet.findOne({ where: { userId } });
        const mentor = await Mentor.findOne({ where: { user_id: userId } });
        
        if (!wallet || wallet.availableBalance < amount) {
            return res.status(400).json({ success: false, message: "Insufficient available balance" });
        }

        // Lock & Deduct
        wallet.availableBalance -= amount;
        await wallet.save();

        // Create Withdrawal
        await Withdrawal.create({
             mentorId: mentor.id,
             amount,
             status: 'completed' 
             // In prod: call Paystack Transfers, set to pending if async
        });

        res.status(200).json({ success: true, message: "Withdrawal successful", newBalance: wallet.availableBalance });
    } catch (err) {
        console.error("Withdrawal error:", err);
        res.status(500).json({ success: false, message: "Server error during withdrawal" });
    }
};

exports.getWallet = async (req, res) => {
    try {
        const userId = req.user.id;
        let wallet = await Wallet.findOne({ where: { userId } });
        if (!wallet) wallet = await Wallet.create({ userId });
        
        const mentor = await Mentor.findOne({ where: { user_id: userId } });
        let transactions = [];
        let withdrawals = [];
        if (mentor) {
            const appointments = await Appointment.findAll({ where: { mentorId: mentor.id }, attributes: ['id'] });
            const appointmentIds = appointments.map(a => a.id);
            transactions = await Payment.findAll({ where: { appointmentId: appointmentIds }, order: [['createdAt', 'DESC']] });
            withdrawals = await Withdrawal.findAll({ where: { mentorId: mentor.id }, order: [['createdAt', 'DESC']] });
        }

        res.status(200).json({ success: true, wallet, transactions, withdrawals });
    } catch (err) {
        console.error("Get Wallet error:", err);
        res.status(500).json({ success: false, message: "Server error fetching wallet" });
    }
};

exports.getAdminWallet = async (req, res) => {
    try {
        if (req.user.userType !== 'admin') return res.status(403).json({ success: false, message: "Forbidden" });
        const wallet = await getPlatformAdminWallet();
        const transactions = await Payment.findAll({ 
            order: [['createdAt', 'DESC']], 
            limit: 100,
            include: [{
                model: Appointment,
                as: 'appointment',
                include: [{
                    model: Mentor,
                    as: 'mentor',
                    include: [{
                        model: User,
                        as: 'user',
                        attributes: ['id', 'name', 'picture']
                    }]
                }]
            }]
        });
        const allWithdrawals = await Withdrawal.findAll({ order: [['createdAt', 'DESC']], include: ['mentor'] });

        res.status(200).json({ success: true, wallet, transactions, allWithdrawals });
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error" });
    }
};

exports.getTransactions = async (req, res) => {
    try {
        if (req.user.userType !== 'admin') return res.status(403).json({ success: false, message: "Forbidden" });
        const transactions = await Payment.findAll({ 
            order: [['createdAt', 'DESC']],
            include: [{
                model: Appointment,
                as: 'appointment',
                include: [{
                    model: Mentor,
                    as: 'mentor',
                    include: [{
                        model: User,
                        as: 'user',
                        attributes: ['id', 'name', 'picture']
                    }]
                }]
            }]
        });
        res.status(200).json({ success: true, transactions });
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error" });
    }
};
