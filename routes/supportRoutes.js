const router = require("express").Router();
const rateLimit = require("express-rate-limit");
const {
  text,
  escapeHtml,
  HttpError,
  respondError,
} = require("../utils/security");
router.post(
  "/contact",
  rateLimit({
    windowMs: 3600000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
  }),
  async (req, res) => {
    try {
      if (!process.env.SUPPORT_EMAIL)
        throw new HttpError(
          503,
          "Contact form is unavailable. Please email support directly.",
        );
      const name = text(req.body.name, "Name", 150),
        email = text(req.body.email, "Email", 254),
        subject = text(req.body.subject, "Subject", 150),
        message = text(req.body.message, "Message", 5000);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        throw new HttpError(400, "Enter a valid email address");
      const sent = await require("../services/emailService").sendEmail({
        to: process.env.SUPPORT_EMAIL,
        subject: "Wisicom support request",
        html: `<p>From: ${escapeHtml(name)} (${escapeHtml(email)})</p><h2>${escapeHtml(subject)}</h2><p>${escapeHtml(message)}</p>`,
      });
      if (!sent)
        throw new HttpError(
          502,
          "Unable to deliver your message. Please try again or email support directly.",
        );
      res
        .status(201)
        .json({
          success: true,
          message: "Your message was delivered to support",
        });
    } catch (error) {
      respondError(res, error);
    }
  },
);
module.exports = router;
