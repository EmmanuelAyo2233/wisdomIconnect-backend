/**
 * Input Sanitization Middleware
 *
 * Provides reusable sanitization helpers to protect against XSS attacks
 * by trimming whitespace and HTML-escaping user-supplied text fields
 * before they reach the database or any downstream logic.
 *
 * Uses the `validator` package (bundled with express-validator) for escaping.
 */

const { body, validationResult } = require("express-validator");

/**
 * sanitizeFields(fields)
 * Returns an array of express-validator chains that:
 *  - Trims leading/trailing whitespace
 *  - Escapes HTML special characters (<, >, &, ", ', /)
 *
 * Usage in routes:
 *   router.post("/register", sanitizeFields(["name", "email"]), handler);
 *
 * @param {string[]} fields - Array of req.body field names to sanitize
 * @returns {import("express-validator").ValidationChain[]}
 */
const sanitizeFields = (fields = []) => {
  return fields.map((field) =>
    body(field)
      .optional({ nullable: true, checkFalsy: false })
      .trim()
      .escape()
  );
};

/**
 * sanitizeMiddleware
 * A pre-built middleware that runs after sanitizeFields chains.
 * Passes through — sanitization doesn't block requests (no validation errors thrown).
 * Use this if you want a single middleware that does both sanitize + pass-through.
 *
 * @param {string[]} fields
 * @returns {import("express").RequestHandler[]}
 */
const sanitizeMiddleware = (fields = []) => {
  return [
    ...sanitizeFields(fields),
    (req, res, next) => {
      // Sanitization always passes through — we don't reject on escape.
      // If you want validation errors too, call validationResult(req) here.
      next();
    },
  ];
};

module.exports = { sanitizeFields, sanitizeMiddleware };
