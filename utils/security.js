const crypto = require("crypto");

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}
const positiveId = (value) => {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0)
    throw new HttpError(400, "Invalid identifier");
  return id;
};
const text = (value, name, max = 500, required = true) => {
  if (value == null && !required) return "";
  if (
    typeof value !== "string" ||
    (required && !value.trim()) ||
    value.length > max
  ) {
    throw new HttpError(
      400,
      `${name} must be valid text (maximum ${max} characters)`,
    );
  }
  return value.trim();
};
const accountEligible = (user) =>
  Boolean(user && user.accountStatus === "active" && user.isVerified);
const otp = () => crypto.randomInt(100000, 1000000).toString();
const hashCode = (code) =>
  crypto.createHash("sha256").update(String(code)).digest("hex");
const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const publicUser = (user) => {
  const data = user.get ? user.get({ plain: true }) : { ...user };
  for (const key of [
    "password",
    "verificationToken",
    "passwordResetToken",
    "verificationExpires",
    "passwordResetExpires",
    "tokenVersion",
  ])
    delete data[key];
  return data;
};
const respondError = (res, error) =>
  res
    .status(error.statusCode || 500)
    .json({
      status: "fail",
      success: false,
      message: error.statusCode
        ? error.message
        : "Unable to complete this request. Please try again.",
    });
module.exports = {
  HttpError,
  positiveId,
  text,
  accountEligible,
  otp,
  hashCode,
  escapeHtml,
  publicUser,
  respondError,
};
