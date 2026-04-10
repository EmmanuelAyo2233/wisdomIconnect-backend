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

        if (appointment.status !== "accepted") {
            return res.status(400).json({ status: "fail", message: "Meeting is not active ❌" });
        }

        // Verify User is mentor or mentee of this appointment
        let isAuthorized = false;
        if (role === "mentor") {
            const mentor = await Mentor.findOne({ where: { user_id: userId } });
            if (mentor && mentor.id === appointment.mentorId) isAuthorized = true;
        } else if (role === "mentee") {
            const mentee = await Mentee.findOne({ where: { user_id: userId } });
            if (mentee && mentee.id === appointment.menteeId) isAuthorized = true;
        }

        if (!isAuthorized) {
            return res.status(403).json({ status: "fail", message: "Unauthorized to join this call ❌" });
        }

        // Time Validation: Can only join 5 minutes before startTime
        // The date and startTime from the appointment
        const [year, month, day] = appointment.date.split("-");
        const [hours, minutes, seconds] = appointment.startTime.split(":");
        
        const sessionStartTime = new Date(year, month - 1, day, hours, minutes, seconds || 0);
        const currentTime = new Date();
        
        const diffMs = sessionStartTime.getTime() - currentTime.getTime();
        const diffMinutes = Math.floor(diffMs / 60000);

        if (diffMinutes > 5) {
            return res.status(403).json({ 
                status: "fail", 
                message: `Too early. You can join 5 minutes before the scheduled time (${appointment.startTime}).` 
            });
        }

        // Payment validation
        const payment = await Payment.findOne({ where: { appointmentId: appointment.id } });
        if (payment && payment.amount > 0) {
            // "pending" means it's paid and in escrow. "awaiting_acceptance" means mentor hasn't accepted.
            // If it's accepted, payment is pending.
            if (payment.status !== "pending" && payment.status !== "released") {
                return res.status(403).json({ status: "fail", message: "Payment not completed for this session." });
            }
        }

        return res.status(200).json({
            status: "success",
            message: "Access granted ✅",
            data: {
                appointmentId: appointment.id,
                meetingId: appointment.meetingId,
                role: role,
                endTime: appointment.endTime
            }
        });
    } catch (error) {
        console.error("❌ Verify call access error:", error);
        res.status(500).json({ status: "error", message: "Server error ❌", error: error.message });
    }
};
