const Waitlist = require("../models/waitlist");
const { EMAIL_REGEX, Op } = require("../config/reuseablePackages");

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
