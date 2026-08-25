const Waitlist = require("../models/waitlist");
const { EMAIL_REGEX, Op } = require("../config/reuseablePackages");
const emailService = require("../services/emailService");

// ── Confirmation email HTML template
const waitlistConfirmationEmail = (name, role) => `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Welcome to Wisicom Waitlist</title></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
        <!-- Header stripe -->
        <tr><td style="background:linear-gradient(90deg,#B22222,#d44444,#B22222);height:4px;"></td></tr>
        <!-- Logo + Brand -->
        <tr><td style="padding:36px 36px 0;text-align:center;">
          <p style="margin:0;font-size:22px;font-weight:900;color:#111111;letter-spacing:-0.5px;">
            Wisi<span style="color:#B22222;">com</span>
          </p>
        </td></tr>
        <!-- Headline -->
        <tr><td style="padding:28px 36px 0;text-align:center;">
          <h1 style="margin:0;font-size:26px;font-weight:900;color:#111111;letter-spacing:-0.5px;line-height:1.2;">
            You're on the list! 🎉
          </h1>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:16px 36px 28px;text-align:center;">
          <p style="margin:0 0 12px;font-size:15px;color:#6b7280;line-height:1.6;">
            Hi <strong style="color:#111;">${name}</strong>, welcome to the Wisicom early access community.
          </p>
          <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
            You've reserved your spot as a <strong style="color:#B22222;text-transform:capitalize;">${role}</strong>.
            We're working hard behind the scenes and you'll be among the <em>very first</em> to hear from us when we're ready.
          </p>
          <!-- Role badge -->
          <div style="display:inline-block;padding:8px 18px;background:#fff5f5;border:1px solid #fca5a5;border-radius:99px;font-size:13px;font-weight:700;color:#B22222;text-transform:capitalize;margin-bottom:28px;">
            ${role === 'mentee' ? '🎓 Mentee' : '💡 Mentor'}
          </div>
          <!-- Divider -->
          <hr style="border:none;border-top:1px solid #f3f4f6;margin:0 0 24px;" />
          <!-- What to expect -->
          <p style="margin:0 0 16px;font-size:12px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;">What to expect</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="text-align:left;">
            <tr>
              <td style="padding:8px 0;font-size:14px;color:#374151;">
                ✅ &nbsp;<strong>Priority access</strong> — you're first in line for mentor matching.
              </td>
            </tr>
            <tr>
              <td style="padding:8px 0;font-size:14px;color:#374151;">
                📚 &nbsp;<strong>Vetted mentors</strong> — every mentor is reviewed before joining.
              </td>
            </tr>
            <tr>
              <td style="padding:8px 0;font-size:14px;color:#374151;">
                🎁 &nbsp;<strong>Pioneer perks</strong> — exclusive benefits for early members.
              </td>
            </tr>
          </table>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 36px 32px;text-align:center;background:#fafafa;border-top:1px solid #f3f4f6;">
          <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
            You received this because you joined the Wisicom waitlist.<br>
            We will never share your information. <strong>No spam, ever.</strong>
          </p>
          <p style="margin:10px 0 0;font-size:12px;color:#d1d5db;">
            © ${new Date().getFullYear()} Wisicom · Connecting ambition with wisdom.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
`;

const VALID_ROLES = ["mentor", "mentee"];
const VALID_STATUSES = ["pending", "invited", "joined"];
const VALID_INTERESTS = [
    "Technology", "Business", "Career", "Education", "Agriculture",
    "Personal Development", "Entrepreneurship", "Creative Skills", "Other"
];

// ─── PUBLIC ───────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/waitlist
 * Public – no auth required
 */
const joinWaitlist = async (req, res) => {
    try {
        let { full_name, email, role, interests, message } = req.body;

        // ── Basic presence checks
        if (!full_name || !full_name.trim()) {
            return res.status(400).json({ status: "fail", message: "Full name is required." });
        }
        if (!email || !email.trim()) {
            return res.status(400).json({ status: "fail", message: "Email address is required." });
        }
        if (!role) {
            return res.status(400).json({ status: "fail", message: "Please select a role (mentor or mentee)." });
        }

        // ── Normalise
        full_name = full_name.trim();
        email = email.trim().toLowerCase();
        role = role.trim().toLowerCase();

        // ── Validate email format
        if (!EMAIL_REGEX.test(email)) {
            return res.status(400).json({ status: "fail", message: "Please enter a valid email address." });
        }

        // ── Validate role
        if (!VALID_ROLES.includes(role)) {
            return res.status(400).json({ status: "fail", message: "Role must be 'mentor' or 'mentee'." });
        }

        // ── Validate interests (optional but must be valid values if provided)
        let sanitisedInterests = [];
        if (interests) {
            if (!Array.isArray(interests)) {
                return res.status(400).json({ status: "fail", message: "Interests must be an array." });
            }
            sanitisedInterests = interests.filter(i => VALID_INTERESTS.includes(i));
        }

        // ── Sanitise message
        const sanitisedMessage = message && message.trim() ? message.trim() : null;

        // ── Duplicate email check
        const existing = await Waitlist.findOne({ where: { email } });
        if (existing) {
            return res.status(409).json({
                status: "fail",
                message: "You're already on the list! 🎉 We'll reach out when we're ready.",
                already_registered: true,
            });
        }

        // ── Create record
        const entry = await Waitlist.create({
            full_name,
            email,
            role,
            interests: sanitisedInterests,
            message: sanitisedMessage,
            status: "pending",
        });

        // ── Send Confirmation Email asynchronously in background
        emailService.sendEmail({
            to: entry.email,
            subject: "You're on the Wisicom Waitlist! 🎉",
            html: waitlistConfirmationEmail(entry.full_name, entry.role),
        }).catch(err => console.error("Failed to send waitlist confirmation email:", err.message));

        return res.status(201).json({
            status: "success",
            message: "You're on the waitlist! We'll be in touch soon.",
            data: {
                id: entry.id,
                full_name: entry.full_name,
                email: entry.email,
                role: entry.role,
                status: entry.status,
                createdAt: entry.createdAt,
            },
        });
    } catch (err) {
        console.error("Waitlist join error:", err);
        return res.status(500).json({ status: "error", message: "Something went wrong. Please try again." });
    }
};

// ─── ADMIN ────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/waitlist
 * Admin only – paginated list with search & filter
 */
const getWaitlist = async (req, res) => {
    try {
        const { search, role, status, page = 1, limit = 50 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const where = {};

        if (role && VALID_ROLES.includes(role)) {
            where.role = role;
        }
        if (status && VALID_STATUSES.includes(status)) {
            where.status = status;
        }
        if (search && search.trim()) {
            const term = `%${search.trim()}%`;
            where[Op.or] = [
                { full_name: { [Op.like]: term } },
                { email: { [Op.like]: term } },
            ];
        }

        const { count, rows } = await Waitlist.findAndCountAll({
            where,
            order: [["createdAt", "DESC"]],
            limit: parseInt(limit),
            offset,
        });

        return res.status(200).json({
            status: "success",
            data: rows,
            total: count,
            page: parseInt(page),
            totalPages: Math.ceil(count / parseInt(limit)),
        });
    } catch (err) {
        console.error("Admin get waitlist error:", err);
        return res.status(500).json({ status: "error", message: "Failed to retrieve waitlist." });
    }
};

/**
 * GET /api/v1/waitlist/stats
 * Admin only – summary counts
 */
const getWaitlistStats = async (req, res) => {
    try {
        const total = await Waitlist.count();
        const mentees = await Waitlist.count({ where: { role: "mentee" } });
        const mentors = await Waitlist.count({ where: { role: "mentor" } });
        const pending = await Waitlist.count({ where: { status: "pending" } });
        const invited = await Waitlist.count({ where: { status: "invited" } });
        const joined = await Waitlist.count({ where: { status: "joined" } });

        return res.status(200).json({
            status: "success",
            data: { total, mentees, mentors, pending, invited, joined },
        });
    } catch (err) {
        console.error("Admin waitlist stats error:", err);
        return res.status(500).json({ status: "error", message: "Failed to retrieve waitlist stats." });
    }
};

/**
 * PATCH /api/v1/waitlist/:id/status
 * Admin only – update a single entry's status
 */
const updateWaitlistStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status || !VALID_STATUSES.includes(status)) {
            return res.status(400).json({ status: "fail", message: `Status must be one of: ${VALID_STATUSES.join(", ")}.` });
        }

        const entry = await Waitlist.findByPk(id);
        if (!entry) {
            return res.status(404).json({ status: "fail", message: "Waitlist entry not found." });
        }

        entry.status = status;
        await entry.save();

        return res.status(200).json({
            status: "success",
            message: `Status updated to '${status}'.`,
            data: entry,
        });
    } catch (err) {
        console.error("Update waitlist status error:", err);
        return res.status(500).json({ status: "error", message: "Failed to update status." });
    }
};

/**
 * DELETE /api/v1/waitlist/:id
 * Admin only – remove an entry
 */
const deleteWaitlistEntry = async (req, res) => {
    try {
        const { id } = req.params;
        const entry = await Waitlist.findByPk(id);
        if (!entry) {
            return res.status(404).json({ status: "fail", message: "Waitlist entry not found." });
        }
        await entry.destroy();
        return res.status(200).json({ status: "success", message: "Entry removed from waitlist." });
    } catch (err) {
        console.error("Delete waitlist entry error:", err);
        return res.status(500).json({ status: "error", message: "Failed to delete entry." });
    }
};

module.exports = {
    joinWaitlist,
    getWaitlist,
    getWaitlistStats,
    updateWaitlistStatus,
    deleteWaitlistEntry,
};
