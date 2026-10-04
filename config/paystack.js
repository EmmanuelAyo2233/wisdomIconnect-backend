// Payment environment follows the server secret, independently of hosting mode.
function paymentMode(env = process.env) {
  const match = /^sk_(test|live)_.+$/.exec(env.PAYSTACK_SECRET_KEY || "");
  if (!match) throw new Error("A valid Paystack secret key is required");
  if (env.PAYSTACK_MODE && env.PAYSTACK_MODE !== match[1]) {
    throw new Error("PAYSTACK_MODE does not match the configured secret key");
  }
  return match[1];
}
module.exports = { paymentMode };
