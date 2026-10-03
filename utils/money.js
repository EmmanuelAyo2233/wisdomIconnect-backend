const { HttpError } = require("./security");
function toMinor(value, allowZero = true) {
  if (typeof value !== "number" && typeof value !== "string")
    throw new HttpError(400, "Invalid amount");
  const input = String(value);
  if (!/^\d+(?:\.\d{1,2})?$/.test(input))
    throw new HttpError(400, "Amount must have at most two decimal places");
  const [whole, fraction = ""] = input.split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (
    !Number.isSafeInteger(minor) ||
    minor < (allowZero ? 0 : 1) ||
    minor > 10000000000
  )
    throw new HttpError(400, "Amount is outside the supported range");
  return minor;
}
const fromMinor = (value) => (value / 100).toFixed(2);
function split(amount, rate) {
  const percent = Number(rate);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100)
    throw new HttpError(500, "Invalid platform commission configuration");
  const platform = Math.round((amount * percent) / 100);
  return { platform, mentor: amount - platform };
}
module.exports = { toMinor, fromMinor, split };
