const crypto = require("crypto");
const { paymentMode } = require("../config/paystack");
const { HttpError, positiveId } = require("../utils/security");
const { toMinor, fromMinor, split } = require("../utils/money");
const { appointmentFor } = require("./authorizationService");
const models = () => require("../models");
const sequelize = () => models().db.sequelize;
const PaymentIntent = () => require("../models/paymentIntent");
const Ledger = () => require("../models/ledgerEntry");

async function platformUser(transaction) {
  const { User } = models();
  const configured = process.env.PLATFORM_ADMIN_USER_ID;
  const admin = configured
    ? await User.findByPk(positiveId(configured), { transaction })
    : await User.findOne({
        where: { userType: "admin" },
        order: [["id", "ASC"]],
        transaction,
      });
  if (!admin || admin.userType !== "admin")
    throw new HttpError(503, "Platform settlement account is not configured");
  return admin;
}
async function walletFor(userId, transaction) {
  const { Wallet, User } = models();
  // Lock the parent to serialize initial wallet creation as well as balance changes.
  await User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
  let wallet = await Wallet.findOne({
    where: { userId },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!wallet) wallet = await Wallet.create({ userId }, { transaction });
  return wallet;
}
async function changeWallet(
  userId,
  available,
  pending,
  kind,
  reference,
  transaction,
  earned = 0,
) {
  const operationKey = `${kind}:${reference}:${userId}`;
  if (await Ledger().findOne({ where: { operationKey }, transaction })) return;
  const wallet = await walletFor(userId, transaction);
  const nextAvailable = toMinor(wallet.availableBalance) + available;
  const nextPending = toMinor(wallet.pendingBalance) + pending;
  if (nextAvailable < 0 || nextPending < 0)
    throw new HttpError(
      409,
      "Wallet requires reconciliation before this operation",
    );
  await wallet.update(
    {
      availableBalance: fromMinor(nextAvailable),
      pendingBalance: fromMinor(nextPending),
      totalEarned: fromMinor(toMinor(wallet.totalEarned) + earned),
    },
    { transaction },
  );
  await Ledger().create(
    {
      operationKey,
      userId,
      availableDeltaMinor: available,
      pendingDeltaMinor: pending,
      kind,
      reference,
    },
    { transaction },
  );
}
async function lockPayment(id, transaction) {
  const { Payment, Appointment } = models();
  // Always lock appointment before payment, matching booking/verification lock order.
  const appointment = await Appointment.findByPk(positiveId(id), {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  const payment = await Payment.findOne({
    where: { appointmentId: id },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  return { appointment, payment };
}
async function paymentOwners(appointment, payment, transaction) {
  const { Mentor } = models();
  const mentor = await Mentor.findByPk(appointment.mentorId, { transaction });
  const admin = payment.platformUserId
    ? { id: payment.platformUserId }
    : await platformUser(transaction);
  return [mentor.user_id, admin.id];
}
async function creditShares(appointment, payment, kind, release, transaction) {
  const [mentorId, adminId] = await paymentOwners(
    appointment,
    payment,
    transaction,
  );
  const shares = [
    [mentorId, toMinor(payment.mentorShare)],
    [adminId, toMinor(payment.platformShare)],
  ];
  shares.sort((a, b) => a[0] - b[0]);
  for (const [id, amount] of shares)
    await changeWallet(
      id,
      release ? amount : 0,
      release ? -amount : amount,
      kind,
      payment.reference,
      transaction,
      release ? amount : 0,
    );
}
function validateCharge(data, intent) {
  if (
    !data ||
    data.status !== "success" ||
    data.reference !== intent.reference ||
    data.currency !== intent.currency ||
    Number(data.amount) !== Number(intent.amountMinor) ||
    String(data.customer?.email).toLowerCase() !== intent.email.toLowerCase()
  )
    throw new HttpError(400, "Payment does not match this booking");
  const expectedDomain = paymentMode();
  if (data.domain !== expectedDomain)
    throw new HttpError(400, "Payment environment mismatch");
}
async function settleCharge(data, user) {
  const intentSnapshot = await PaymentIntent().findByPk(data.reference);
  if (!intentSnapshot) throw new HttpError(404, "Payment intent not found");
  if (
    user &&
    user.userType !== "admin" &&
    Number(intentSnapshot.userId) !== Number(user.id)
  )
    throw new HttpError(403, "Payment does not belong to you");
  validateCharge(data, intentSnapshot);
  return sequelize().transaction(async (transaction) => {
    const { Appointment, Payment } = models();
    const appointment = await Appointment.findByPk(
      intentSnapshot.appointmentId,
      { transaction, lock: transaction.LOCK.UPDATE },
    );
    const intent = await PaymentIntent().findByPk(data.reference, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const existing = await Payment.findOne({
      where: { reference: data.reference },
      transaction,
    });
    if (existing) return existing;
    if (!appointment || appointment.status !== "pending_payment")
      throw new HttpError(
        409,
        "Payment needs manual reconciliation; reservation is no longer active",
      );
    const admin = await platformUser(transaction);
    const shares = split(Number(intent.amountMinor), intent.commissionRate);
    const payment = await Payment.create(
      {
        reference: intent.reference,
        providerTransactionId: data.id ? String(data.id) : null,
        appointmentId: appointment.id,
        amount: fromMinor(Number(intent.amountMinor)),
        mentorShare: fromMinor(shares.mentor),
        platformShare: fromMinor(shares.platform),
        platformUserId: admin.id,
        status: "pending",
        escrow_status: "held",
      },
      { transaction },
    );
    await creditShares(appointment, payment, "hold", false, transaction);
    const mentor = await models().Mentor.findByPk(appointment.mentorId, {
      transaction,
    });
    const meetingId = mentor.autoAccept ? crypto.randomUUID() : null;
    await appointment.update(
      {
        status: mentor.autoAccept ? "accepted" : "pending",
        meetingId,
        meetingLink: meetingId ? `/call/${meetingId}` : null,
      },
      { transaction },
    );
    await intent.update({ status: "paid" }, { transaction });
    await require("./bookingNotificationService").record(
      appointment,
      "Payment verified; session booked",
      transaction,
    );
    return payment;
  });
}
async function release(id, user, adminResolution = false) {
  return sequelize().transaction(async (transaction) => {
    const { appointment, payment } = await lockPayment(id, transaction);
    await appointmentFor(user, appointment, adminResolution);
    if (appointment.status === "completed") return appointment;
    if (adminResolution) {
      if (user.userType !== "admin" || appointment.status !== "under_review")
        throw new HttpError(403, "Admin dispute resolution required");
    } else if (
      !["accepted", "ongoing", "call_ended"].includes(appointment.status) ||
      !appointment.mentorConfirmed ||
      !appointment.menteeConfirmed
    ) {
      throw new HttpError(
        409,
        "Both participants must confirm completion before funds are released",
      );
    }
    if (appointment.sessionType === "paid") {
      if (
        !payment ||
        !["pending", ...(adminResolution ? ["disputed"] : [])].includes(
          payment.status,
        ) ||
        (payment.refundState && payment.refundState !== "none")
      )
        throw new HttpError(409, "Payment is not eligible for release");
      await creditShares(appointment, payment, "release", true, transaction);
      await payment.update(
        { status: "released", escrow_status: "released" },
        { transaction },
      );
    }
    await appointment.update(
      {
        status: "completed",
        completion_status: "completed",
        completionMethod: adminResolution ? "admin_release" : "dual_confirm",
      },
      { transaction },
    );
    await require("./sessionProgressService").updateProgress(
      appointment,
      transaction,
    );
    await require("./bookingNotificationService").record(
      appointment,
      "Session completed",
      transaction,
    );
    return appointment;
  });
}
async function reserveRefund(id, user, reason, allowAdmin = false) {
  return sequelize().transaction(async (transaction) => {
    const { appointment, payment } = await lockPayment(id, transaction);
    await appointmentFor(user, appointment, allowAdmin);
    if (!payment) throw new HttpError(409, "Payment requires reconciliation");
    if (payment.refundState && payment.refundState !== "none")
      return { appointment, payment, existing: true };
    if (
      !allowAdmin &&
      !["pending", "accepted", "mentor-rescheduled"].includes(
        appointment.status,
      )
    )
      throw new HttpError(409, "This session requires admin refund review");
    if (
      ![
        "pending",
        "awaiting_acceptance",
        ...(allowAdmin ? ["disputed"] : []),
      ].includes(payment.status)
    )
      throw new HttpError(
        409,
        "This payment requires admin review before refunding",
      );
    await payment.update(
      {
        originalUncredited: payment.status === "awaiting_acceptance",
        refundState: "requested",
        refundReason: reason,
        status: "disputed",
        escrow_status: "disputed",
      },
      { transaction },
    );
    await appointment.update(
      {
        status: "cancelled",
        completion_status: "cancelled",
        refund_status: "pending",
      },
      { transaction },
    );
    await require("./bookingNotificationService").record(
      appointment,
      "Cancellation requested",
      transaction,
    );
    return { appointment, payment };
  });
}
async function requestRefund(id, user, reason, allowAdmin = false) {
  const reserved = await reserveRefund(id, user, reason, allowAdmin);
  if (!reserved.payment || reserved.existing) return reserved;
  // The DB reservation is committed before making the external request. Unknown outcomes
  // are never blindly retried; webhook/reconciliation is the authority on completion.
  const result = await require("./paystackService").processRefund(
    reserved.payment.reference,
    Number(reserved.payment.amount),
  );
  await models().Payment.update(
    {
      refundState: result.success ? "processing" : "needs_review",
      refund_reference: result.success
        ? String(result.data?.id || result.data?.reference || "")
        : null,
    },
    { where: { id: reserved.payment.id, refundState: "requested" } },
  );
  return reserved;
}
async function finishRefund(reference, success, providerData) {
  const snapshot = await models().Payment.findOne({ where: { reference } });
  if (!snapshot) throw new HttpError(404, "Refund payment not found");
  return sequelize().transaction(async (transaction) => {
    const { appointment, payment } = await lockPayment(
      snapshot.appointmentId,
      transaction,
    );
    if (payment.status === "refunded") return;
    if (
      success &&
      providerData &&
      (Number(providerData.amount) !== toMinor(payment.amount) ||
        providerData.currency !== "NGN" ||
        providerData.domain !== paymentMode())
    )
      throw new HttpError(
        409,
        "Refund amount or environment requires reconciliation",
      );
    if (
      !["requested", "processing", "needs_review"].includes(payment.refundState)
    )
      throw new HttpError(409, "Unrequested refund requires reconciliation");
    if (!success) {
      await payment.update({ refundState: "needs_review" }, { transaction });
      return;
    }
    const [mentorId, adminId] = await paymentOwners(
      appointment,
      payment,
      transaction,
    );
    const entries = [
      [mentorId, toMinor(payment.mentorShare)],
      [adminId, toMinor(payment.platformShare)],
    ].sort((a, b) => a[0] - b[0]);
    // Older awaiting-acceptance payments were not credited; do not invent a reversal.
    if (payment.originalUncredited !== true)
      for (const [id, amount] of entries)
        await changeWallet(
          id,
          0,
          -amount,
          "refund",
          payment.reference,
          transaction,
        );
    await payment.update(
      {
        status: "refunded",
        escrow_status: "refunded",
        refundState: "succeeded",
        refundedAt: new Date(),
      },
      { transaction },
    );
    await appointment.update(
      {
        status: "cancelled",
        refund_status: "refunded",
        completion_status: "cancelled",
      },
      { transaction },
    );
    if (appointment.slotId)
      await models().Availability.update(
        { status: "available" },
        { where: { id: appointment.slotId }, transaction },
      );
  });
}
module.exports = {
  platformUser,
  walletFor,
  changeWallet,
  settleCharge,
  validateCharge,
  release,
  requestRefund,
  reserveRefund,
  finishRefund,
};
