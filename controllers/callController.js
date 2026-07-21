const { Appointment, Mentor, Mentee, Payment } = require("../models");

exports.verifyCallAccess = async (req, res) => {
    try {
        const { meetingId } = req.params;
        const userId = req.user.id; // logged in user ID
        const role = req.user.userType; // 'mentor' or 'mentee'

        const appointment = await Appointment.findOne({ where: { meetingId } });

        if (!appointment) {
            return res.status(404).json({ status: "fail", message: "Meeting not found ❌" });
        }

        const allowedStatuses = ["accepted", "ongoing", "in_progress"];
        if (!allowedStatuses.includes(appointment.status)) {
            return res.status(400).json({ status: "fail", message: `Meeting is not active (Status: ${appointment.status}) ❌` });
        }

        // Verify User is mentor or mentee of this appointment directly by user_id
        const mentorRecord = await Mentor.findOne({ where: { user_id: userId } });
        const menteeRecord = await Mentee.findOne({ where: { user_id: userId } });

        let isAuthorized = false;
        let userRoleInCall = role || req.user.role;

        if (mentorRecord && mentorRecord.id === appointment.mentorId) {
            isAuthorized = true;
            userRoleInCall = "mentor";
        } else if (menteeRecord && menteeRecord.id === appointment.menteeId) {
            isAuthorized = true;
            userRoleInCall = "mentee";
        } else if (req.user.userType === "admin" || req.user.role === "admin") {
            isAuthorized = true;
        }

        if (!isAuthorized) {
            return res.status(403).json({ status: "fail", message: "Unauthorized to join this call ❌" });
        }

        // Payment validation
        const payment = await Payment.findOne({ where: { appointmentId: appointment.id } });
        if (payment && payment.amount > 0) {
            const validPaymentStatuses = ["pending", "released", "completed", "successful", "escrow", "awaiting_acceptance"];
            if (!validPaymentStatuses.includes(payment.status)) {
                return res.status(403).json({ status: "fail", message: "Payment not completed for this session." });
            }
        }

        // Fetch participant details for display
        const mentor = await Mentor.findOne({ where: { id: appointment.mentorId }, include: [{ model: require("../models").User, as: "user", attributes: ["name", "picture"] }] });
        const mentee = await Mentee.findOne({ where: { id: appointment.menteeId }, include: [{ model: require("../models").User, as: "user", attributes: ["name", "picture"] }] });

        // Calculate duration from startTime and endTime if not explicitly saved as duration
        let durationMinutes = appointment.duration || 60; // Default fallback
        if (appointment.startTime && appointment.endTime) {
            try {
                const [sh, sm] = appointment.startTime.split(":").map(Number);
                const [eh, em] = appointment.endTime.split(":").map(Number);
                const startTotal = sh * 60 + sm;
                const endTotal = eh * 60 + em;
                if (endTotal > startTotal) {
                    durationMinutes = endTotal - startTotal;
                }
            } catch (e) {
                console.warn("Failed to parse start/end time:", e);
            }
        }

        return res.status(200).json({
            status: "success",
            message: "Access granted ✅",
            data: {
                appointmentId: appointment.id,
                meetingId: appointment.meetingId,
                role: userRoleInCall,
                startTime: appointment.startTime,
                endTime: appointment.endTime,
                callStartedAt: appointment.callStartedAt,
                duration: durationMinutes,
                mentor: mentor?.user ? { name: mentor.user.name, picture: mentor.user.picture } : null,
                mentee: mentee?.user ? { name: mentee.user.name, picture: mentee.user.picture } : null,
            }
        });
    } catch (error) {
        console.error("❌ Verify call access error:", error);
        res.status(500).json({ status: "error", message: "Server error ❌", error: error.message });
    }
};
