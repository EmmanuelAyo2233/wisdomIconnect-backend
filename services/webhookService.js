const crypto = require("crypto");
const Inbox = () => require("../models/webhookEvent");
let running = false;
async function receive(raw, signature) {
  if (
    !process.env.PAYSTACK_SECRET_KEY ||
    !Buffer.isBuffer(raw) ||
    typeof signature !== "string" ||
    !/^[a-f0-9]{128}$/i.test(signature)
  )
    return false;
  const expected = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
    .update(raw)
    .digest();
  if (!crypto.timingSafeEqual(expected, Buffer.from(signature, "hex")))
    return false;
  const event = JSON.parse(raw.toString("utf8"));
  if (
    !["charge.success", "refund.processed", "refund.failed"].includes(
      event.event,
    )
  )
    return true;
  const data = event.data || {};
  // Persist only reconciliation fields; never store card authorizations or full customer data.
  const payload =
    event.event === "charge.success"
      ? {
          id: data.id,
          reference: data.reference,
          amount: data.amount,
          currency: data.currency,
          status: data.status,
          domain: data.domain,
          customer: { email: data.customer?.email },
        }
      : {
          reference: data.transaction?.reference,
          refundId: data.id,
          transactionId:
            typeof data.transaction === "number"
              ? String(data.transaction)
              : data.transaction?.id
                ? String(data.transaction.id)
                : null,
          amount: data.amount,
          currency: data.currency,
          domain: data.domain,
        };
  const key = crypto.createHash("sha256").update(raw).digest("hex");
  await Inbox().findOrCreate({
    where: { key },
    defaults: { event: event.event, payload },
  });
  return true;
}
async function drain() {
  if (running) return;
  running = true;
  try {
    const events = await Inbox().findAll({
      where: { status: "pending" },
      order: [["createdAt", "ASC"]],
      limit: 20,
    });
    const finance = require("./financeService");
    for (const event of events) {
      try {
        if (event.event === "charge.success")
          await finance.settleCharge(event.payload);
        else {
          const { Op } = require("sequelize");
          const conditions = [];
          if (event.payload.reference)
            conditions.push({ reference: event.payload.reference });
          if (event.payload.refundId)
            conditions.push({
              refund_reference: String(event.payload.refundId),
            });
          if (event.payload.transactionId)
            conditions.push({
              providerTransactionId: String(event.payload.transactionId),
            });
          const payment =
            conditions.length &&
            (await require("../models").Payment.findOne({
              where: { [Op.or]: conditions },
            }));
          if (!payment)
            throw new Error("Refund requires reference reconciliation");
          await finance.finishRefund(
            payment.reference,
            event.event === "refund.processed",
            event.payload,
          );
        }
        await event.update({ status: "processed" });
      } catch {
        const attempts = event.attempts + 1;
        await event.update({
          attempts,
          status: attempts >= 10 ? "needs_review" : "pending",
        });
      }
    }
  } finally {
    running = false;
  }
}
function start() {
  const timer = setInterval(
    () => drain().catch(() => require('../utils/logger').error("Webhook reconciliation failed")),
    30000,
  );
  timer.unref();
  drain().catch(() => require('../utils/logger').error("Webhook reconciliation failed"));
  return timer;
}
module.exports = { receive, drain, start };
