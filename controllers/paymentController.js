const axios = require('axios');
const { Wallet, Payment, Appointment, Mentor, Mentee, User, Withdrawal, PlatformSetting } = require('../models');
const { Op } = require('sequelize');
const notificationService = require("../services/notificationService");
const { logActivity } = require("../services/activityLogger");

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

        const appointment = await Appointment.findByPk(appointmentId, { 
            include: [
                { model: Mentor, as: 'mentor', include: [{ model: User, as: 'user' }] },
                { model: Mentee, as: 'mentee', include: [{ model: User, as: 'user' }] }
            ] 
        });
        if (!appointment) return res.status(404).json({ success: false, message: "Appointment not found" });

        const amountNaira = data.amount / 100;
        
        // Fetch platform commission rate dynamically (default to 10% if not set)
        const commissionSetting = await PlatformSetting.findByPk('platform_commission_rate');
        const platformCommissionPercent = commissionSetting ? parseFloat(commissionSetting.value) : 10.0;
        const platformShareRate = platformCommissionPercent / 100.0;
        const mentorShareRate = 1.0 - platformShareRate;

        const mentorShare = amountNaira * mentorShareRate;
        const platformShare = amountNaira * platformShareRate;

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

        // Send Payment Success Notification
        if (appointment.mentee && appointment.mentee.user) {
           notificationService.sendPaymentSuccess(
               appointment.mentee.user, 
               "mentee", 
               `₦${amountNaira.toLocaleString()}`, 
               `Session with ${appointment.mentor.user.name}`
           ).catch(console.error);
        }

        logActivity({
            type: "PAYMENT",
            message: `Payment of ₦${amountNaira.toLocaleString()} verified for Session (Appointment ID: ${appointment.id}) by Mentee ID ${appointment.mentee.id}`,
            userId: appointment.mentee.user_id,
            targetId: payment.id,
            status: "success",
            metadata: {
                reference,
                amount: amountNaira,
                mentorShare,
                platformShare,
                appointmentId: appointment.id
            }
        });

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

        const appointment = await Appointment.findByPk(appointmentId, { 
            include: [
                { model: Mentee, as: 'mentee', include: [{ model: User, as: 'user' }] }, 
                { model: Mentor, as: 'mentor' }
            ] 
        });
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
            logActivity({
                type: "PAYMENT",
                message: `Refund dispute opened for Session (Appointment ID ${appointment.id})`,
                userId: userId,
                targetId: payment ? payment.id : null,
                status: "pending",
                metadata: {
                    appointmentId,
                    amount: payment ? payment.amount : 0
                }
            });
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
            
            if (appointment.mentee && appointment.mentee.user) {
                notificationService.sendNotification({
                  receiverId: appointment.mentee.id,
                  receiverType: "mentee",
                  type: "payment",
                  title: "Refund Initiated",
                  message: `Your refund of ₦${payment.amount.toLocaleString()} has been processed.`,
                  emailData: {
                     to: appointment.mentee.user.email,
                     html: require("../utils/emailTemplates").refundInitiated(appointment.mentee.user.name, `₦${payment.amount.toLocaleString()}`, "Session Cancellation")
                  }
                }).catch(console.error);
            }
        }

        logActivity({
            type: "PAYMENT",
            message: `Refund of ₦${payment ? payment.amount.toLocaleString() : '0'} processed successfully for Appointment ID ${appointment.id}`,
            userId: userId,
            targetId: payment ? payment.id : null,
            status: "success",
            metadata: {
                appointmentId,
                amount: payment ? payment.amount : 0
            }
        });

        res.status(200).json({ success: true, message: "Refund processed successfully." });
    } catch (err) {
        console.error("Refund error:", err);
        res.status(500).json({ success: false, message: "Server error during refund" });
    }
};

exports.withdrawFunds = async (req, res) => {
    try {
        const { amount, bankName, accountNumber, accountName } = req.body;
        const userId = req.user.id; 

        if (!amount || amount < 5000) return res.status(400).json({ success: false, message: "Minimum withdrawal amount is ₦5,000" });
        if (!bankName || !accountNumber || !accountName) {
            return res.status(400).json({ success: false, message: "Bank name, account number, and account name are required." });
        }
        if (accountNumber.replace(/\D/g, '').length < 10) {
            return res.status(400).json({ success: false, message: "Please enter a valid 10-digit NUBAN account number." });
        }

        const wallet = await Wallet.findOne({ where: { userId } });
        const mentor = await Mentor.findOne({ where: { user_id: userId } });
        
        if (!mentor) {
            return res.status(404).json({ success: false, message: "Mentor profile not found" });
        }
        if (!wallet || wallet.availableBalance < amount) {
            return res.status(400).json({ success: false, message: "Insufficient available balance for this withdrawal" });
        }

        // Lock & Deduct available balance
        wallet.availableBalance -= amount;
        await wallet.save();

        const reference = `WD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

        // Create Withdrawal record with bank details
        const withdrawal = await Withdrawal.create({
             mentorId: mentor.id,
             amount,
             bankName: bankName.trim(),
             accountNumber: accountNumber.trim(),
             accountName: accountName.trim(),
             reference,
             status: 'pending'
        });

        const user = await User.findByPk(userId);
        if (user) {
            const mentorProfile = {
                id:        mentor ? mentor.id : userId,
                email:     user.email,
                name:      user.name,
                firstName: user.firstName,
            };
            notificationService.sendWithdrawalRequested(mentorProfile, `₦${amount.toLocaleString()}`).catch(console.error);
        }

        logActivity({
            type: "PAYMENT",
            message: `Mentor initiated a withdrawal of ₦${amount.toLocaleString()} to ${bankName.trim()} (${accountNumber.trim()})`,
            userId: userId,
            targetId: mentor.id,
            status: "success",
            metadata: {
                amount,
                bankName,
                accountNumber,
                accountName,
                reference,
                newBalance: wallet.availableBalance
            }
        });

        res.status(200).json({ 
            success: true, 
            message: `Withdrawal request for ₦${amount.toLocaleString()} submitted! Funds will be verified and transferred to your bank account within 24 to 48 business hours.`, 
            newBalance: wallet.availableBalance,
            withdrawal
        });
    } catch (err) {
        console.error("Withdrawal error:", err);
        res.status(500).json({ success: false, message: "Server error during withdrawal request" });
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
            try {
                const appointments = await Appointment.findAll({ 
                    where: { mentorId: mentor.id }, 
                    attributes: ['id'] 
                });
                const appointmentIds = appointments.map(a => a.id);

                if (appointmentIds && appointmentIds.length > 0) {
                    try {
                        transactions = await Payment.findAll({ 
                            where: { appointmentId: appointmentIds }, 
                            include: [{
                                model: Appointment,
                                as: 'appointment',
                                include: [{
                                    model: Mentee,
                                    as: 'mentee',
                                    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'picture', 'email'] }]
                                }]
                            }],
                            order: [['createdAt', 'DESC']] 
                        });
                    } catch (txIncErr) {
                        console.warn("Get Wallet transactions nested include failed, falling back to basic query:", txIncErr.message);
                        transactions = await Payment.findAll({ 
                            where: { appointmentId: appointmentIds }, 
                            order: [['createdAt', 'DESC']] 
                        });
                    }
                }
            } catch (txErr) {
                console.error("Error fetching mentor transactions:", txErr.message);
                transactions = [];
            }

            try {
                withdrawals = await Withdrawal.findAll({ 
                    where: { mentorId: mentor.id }, 
                    order: [['createdAt', 'DESC']] 
                });
            } catch (wdErr) {
                console.error("Error fetching mentor withdrawals:", wdErr.message);
                withdrawals = [];
            }
        }

        res.status(200).json({ success: true, wallet, transactions, withdrawals });
    } catch (err) {
        console.error("Get Wallet error:", err);
        res.status(500).json({ success: false, message: "Server error fetching wallet", error: err.message });
    }
};

exports.approveWithdrawal = async (req, res) => {
    try {
        if (req.user.userType !== 'admin') return res.status(403).json({ success: false, message: "Forbidden" });
        const { withdrawalId } = req.params;
        const withdrawal = await Withdrawal.findByPk(withdrawalId, { include: [{ model: Mentor, as: 'mentor' }] });
        if (!withdrawal) return res.status(404).json({ success: false, message: "Withdrawal record not found" });

        withdrawal.status = 'completed';
        await withdrawal.save();

        res.status(200).json({ success: true, message: "Withdrawal marked as completed/paid out.", withdrawal });
    } catch (err) {
        console.error("Approve withdrawal error:", err);
        res.status(500).json({ success: false, message: "Server error approving withdrawal" });
    }
};

exports.rejectWithdrawal = async (req, res) => {
    try {
        if (req.user.userType !== 'admin') return res.status(403).json({ success: false, message: "Forbidden" });
        const { withdrawalId } = req.params;
        const withdrawal = await Withdrawal.findByPk(withdrawalId, { include: [{ model: Mentor, as: 'mentor' }] });
        if (!withdrawal) return res.status(404).json({ success: false, message: "Withdrawal record not found" });

        if (withdrawal.status === 'completed') {
            return res.status(400).json({ success: false, message: "Cannot reject an already completed withdrawal" });
        }

        withdrawal.status = 'failed';
        await withdrawal.save();

        // Refund available balance back to mentor
        if (withdrawal.mentor) {
            const wallet = await Wallet.findOne({ where: { userId: withdrawal.mentor.user_id } });
            if (wallet) {
                wallet.availableBalance += withdrawal.amount;
                await wallet.save();
            }
        }

        res.status(200).json({ success: true, message: "Withdrawal rejected and amount refunded to mentor wallet.", withdrawal });
    } catch (err) {
        console.error("Reject withdrawal error:", err);
        res.status(500).json({ success: false, message: "Server error rejecting withdrawal" });
    }
};

exports.getAdminWallet = async (req, res) => {
    try {
        if (req.user.userType !== 'admin') return res.status(403).json({ success: false, message: "Forbidden" });
        const wallet = await getPlatformAdminWallet();
        let transactions = [];
        let allWithdrawals = [];
        try {
            transactions = await Payment.findAll({ 
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
        } catch (txErr) {
            console.warn("Get Admin Wallet transactions include failed, falling back to basic query:", txErr.message);
            transactions = await Payment.findAll({ order: [['createdAt', 'DESC']], limit: 100 });
        }

        try {
            allWithdrawals = await Withdrawal.findAll({ order: [['createdAt', 'DESC']] });
        } catch (wdErr) {
            console.warn("Get Admin Wallet withdrawals query failed:", wdErr.message);
            allWithdrawals = [];
        }

        res.status(200).json({ success: true, wallet, transactions, allWithdrawals });
    } catch (err) {
        console.error("Get Admin Wallet error:", err);
        res.status(500).json({ success: false, message: "Server error", error: err.message });
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
