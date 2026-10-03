const {
  HttpError,
  positiveId,
  text,
  respondError,
} = require("../utils/security");
const { toMinor, fromMinor } = require("../utils/money");
const finance = require("../services/financeService");
const axios = require("axios");
const crypto = require("crypto");
const {
  Wallet,
  Payment,
  Appointment,
  Mentor,
  Mentee,
  User,
  Withdrawal,
  PlatformSetting,
} = require("../models");
const { Op } = require("sequelize");
const notificationService = require("../services/notificationService");
const { logActivity } = require("../services/activityLogger");

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

// Helper to get platform admin wallet
const getPlatformAdminWallet = async () =>
  require("../models").db.sequelize.transaction(async (transaction) => {
    const admin = await finance.platformUser(transaction);
    return finance.walletFor(admin.id, transaction);
  });

exports.verifyPayment = async (req, res) => {
  try {
    const reference = text(req.body.reference, "Reference", 100);
    const intent = await require("../models/paymentIntent").findByPk(reference);
    if (!intent || Number(intent.userId) !== Number(req.user.id))
      throw new HttpError(404, "Payment intent not found");
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
        timeout: 15000,
      },
    );
    const payment = await finance.settleCharge(response.data.data, req.user);
    res.json({ success: true, payment, appointmentId: payment.appointmentId });
  } catch (error) {
    respondError(res, error);
  }
};

exports.confirmSession = async (req, res) => {
  try {
    const appointment = await require("../services/sessionService").transition(
      req.user,
      req.body.appointmentId,
      "confirm",
    );
    res.json({ success: true, appointment });
  } catch (error) {
    respondError(res, error);
  }
};

exports.requestRefund = async (req, res) => {
  try {
    await finance.requestRefund(
      positiveId(req.body.appointmentId),
      req.user,
      text(req.body.reason || "Refund requested", "Reason", 500),
    );
    res.json({
      success: true,
      message: "Refund request recorded. Awaiting provider confirmation.",
    });
  } catch (error) {
    respondError(res, error);
  }
};

exports.withdrawFunds = async (req, res) => {
  try {
    if (req.user.userType !== "mentor")
      throw new HttpError(403, "Mentor required");
    const amount = toMinor(req.body.amount);
    if (amount < 500000)
      throw new HttpError(400, "Minimum withdrawal is NGN 5,000");
    const accountNumber = text(req.body.accountNumber, "Account number", 10);
    if (!/^\d{10}$/.test(accountNumber))
      throw new HttpError(400, "Enter a valid ten digit account number");
    const bankName = text(req.body.bankName,"Bank name",100);
    const accountName = text(req.body.accountName,"Account name",100);
    const key = text(
      req.get("Idempotency-Key") || req.body.idempotencyKey,
      "Idempotency key",
      100,
    );
    const withdrawal = await require("../models").db.sequelize.transaction(
      async (transaction) => {
        const mentor = await Mentor.findOne({
          where: { user_id: req.user.id },
          transaction,
        });
        if (!mentor || mentor.kyc_status !== "verified")
          throw new HttpError(403, "Verified KYC is required");
        await finance.walletFor(req.user.id, transaction);
        const idempotencyKey = `${req.user.id}:${key}`;
        const existing = await Withdrawal.findOne({
          where: { idempotencyKey },
          transaction,
        });
        if (existing) {
          if (
            toMinor(existing.amount) !== amount ||
            existing.accountNumber !== accountNumber || existing.bankName !== bankName || existing.accountName !== accountName
          )
            throw new HttpError(
              409,
              "Idempotency key already used for another withdrawal",
            );
          return existing;
        }
        const item = await Withdrawal.create(
          {
            mentorId: mentor.id,
            amount: fromMinor(amount),
            idempotencyKey,
            accountNumber,
            bankName,
            accountName,
            status: "pending",
          },
          { transaction },
        );
        await finance.changeWallet(
          req.user.id,
          -amount,
          0,
          "withdrawal",
          String(item.id),
          transaction,
        );
        return item;
      },
    );
    res
      .status(201)
      .json({
        success: true,
        withdrawal,
        message: "Withdrawal submitted for review",
      });
  } catch (error) {
    respondError(res, error);
  }
};

exports.getWallet = async (req,res) => {
  try {
    const userId=req.user.id;
    let wallet=await Wallet.findOne({where:{userId}});
    if (!wallet) wallet=await require('../models').db.sequelize.transaction(t=>finance.walletFor(userId,t));
    const mentor=await Mentor.findOne({where:{user_id:userId}});
    if (!mentor) throw new HttpError(403,'Mentor wallet required');
    const [transactions,withdrawals]=await Promise.all([
      Payment.findAll({include:[{model:Appointment,as:'appointment',required:true,where:{mentorId:mentor.id},include:[{model:Mentee,as:'mentee',include:[{model:User,as:'user',attributes:['id','name','picture']}]}]}],order:[['createdAt','DESC']]}),
      Withdrawal.findAll({where:{mentorId:mentor.id},order:[['createdAt','DESC']]})
    ]);
    res.json({success:true,wallet,transactions,withdrawals});
  } catch(error) {respondError(res,error);}
};

exports.approveWithdrawal = async (req, res) => {
  try {
    if (req.user.userType !== "admin")
      throw new HttpError(403, "Admin required");
    const reference = text(
      req.body.reference || req.body.transferReference,
      "Completed transfer reference",
      100,
    );
    const withdrawal = await require("../models").db.sequelize.transaction(
      async (transaction) => {
        const item = await Withdrawal.findByPk(
          positiveId(req.params.withdrawalId),
          { transaction, lock: transaction.LOCK.UPDATE },
        );
        if (!item) throw new HttpError(404, "Withdrawal not found");
        if (item.status !== "pending")
          throw new HttpError(409, "Withdrawal already processed");
        return item.update({ status: "completed", reference }, { transaction });
      },
    );
    res.json({
      success: true,
      withdrawal,
      message: "Externally completed transfer recorded",
    });
  } catch (error) {
    respondError(res, error);
  }
};

exports.rejectWithdrawal = async (req, res) => {
  try {
    if (req.user.userType !== "admin")
      throw new HttpError(403, "Admin required");
    await require("../models").db.sequelize.transaction(async (transaction) => {
      const item = await Withdrawal.findByPk(
        positiveId(req.params.withdrawalId),
        { transaction, lock: transaction.LOCK.UPDATE },
      );
      if (!item) throw new HttpError(404, "Withdrawal not found");
      if (item.status !== "pending")
        throw new HttpError(409, "Withdrawal already processed");
      const mentor = await Mentor.findByPk(item.mentorId, { transaction });
      await finance.changeWallet(
        mentor.user_id,
        toMinor(item.amount),
        0,
        "withdrawal_rejected",
        String(item.id),
        transaction,
      );
      await item.update({ status: "failed" }, { transaction });
    });
    res.json({
      success: true,
      message: "Withdrawal rejected and balance restored",
    });
  } catch (error) {
    respondError(res, error);
  }
};

exports.getAdminWallet = async (req,res) => {
  try {
    if (req.user.userType !== 'admin') throw new HttpError(403,'Admin required');
    const wallet=await getPlatformAdminWallet();
    const [transactions,allWithdrawals]=await Promise.all([
      Payment.findAll({order:[['createdAt','DESC']],limit:100,include:[{model:Appointment,as:'appointment',include:[{model:Mentor,as:'mentor',include:[{model:User,as:'user',attributes:['id','name','picture']}]}]}]}),
      Withdrawal.findAll({order:[['createdAt','DESC']]})
    ]);
    res.json({success:true,wallet,transactions,allWithdrawals});
  } catch(error) {respondError(res,error);}
};

exports.getTransactions = async (req, res) => {
  try {
    if (req.user.userType !== "admin")
      return res.status(403).json({ success: false, message: "Forbidden" });
    const transactions = await Payment.findAll({
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: Appointment,
          as: "appointment",
          include: [
            {
              model: Mentor,
              as: "mentor",
              include: [
                {
                  model: User,
                  as: "user",
                  attributes: ["id", "name", "picture"],
                },
              ],
            },
          ],
        },
      ],
    });
    res.status(200).json({ success: true, transactions });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Paystack Webhook Handler
 * Verifies Paystack HMAC SHA512 signature before processing payment events.
 */
exports.paystackWebhook = async (req, res) => {
  try {
    const ok = await require("../services/webhookService").receive(
      req.rawBody || req.body,
      req.get("x-paystack-signature"),
    );
    if (!ok)
      return res
        .status(401)
        .json({ success: false, message: "Invalid signature" });
    res.sendStatus(200);
  } catch (error) {
    respondError(res, error);
  }
};

exports.initializePayment = async (req, res) => {
  try {
    if (!PAYSTACK_SECRET_KEY)
      throw new HttpError(503, "Payment processing is unavailable");
    const { appointment, intent } =
      await require("../services/bookingService").reserve(
        req.user,
        req.body,
        req.body.mentorId,
        true,
      );
    try {
      const response = await axios.post(
        "https://api.paystack.co/transaction/initialize",
        {
          email: intent.email,
          amount: Number(intent.amountMinor),
          currency: intent.currency,
          reference: intent.reference,
        },
        {
          headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
          timeout: 15000,
        },
      );
      if (!response.data.status || !response.data.data?.access_code)
        throw new Error("Provider initialization failed");
      res
        .status(201)
        .json({
          success: true,
          appointmentId: appointment.id,
          reference: intent.reference,
          accessCode: response.data.data.access_code,
        });
    } catch {
      await intent.update({ status: "needs_review" });
      throw new HttpError(
        502,
        "Checkout could not be initialized. Your reservation is retained for reconciliation; contact support before retrying.",
      );
    }
  } catch (error) {
    respondError(res, error);
  }
};
