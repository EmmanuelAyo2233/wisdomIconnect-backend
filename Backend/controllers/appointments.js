const { Appointment, User, Mentee, Mentor } = require("../models");

// Retrieves all appointments for the logged-in mentor
const getAllAppointments = async (req, res) => {
    try {
        const MentorProfile = await Mentor.findOne({
            where: { user_id: req.user.id },
            include: [{ model: User, as: "user", require: false }],
            attributes: { exclude: ["password"] },
        });

        if (!MentorProfile) {
            return res.status(404).json({
                status: "fail",
                message: `Mentor not found`,
            });
        }

        const appointments = await Appointment.findAll({
            where: { mentorId: MentorProfile.id },
            include: [
                {
                    model: Mentee,
                    as: "mentee",
                    include: [
                        {
                            model: User,
                            as: "user",
                            attributes: ["name", "email", "picture"],
                        },
                    ],
                    required: false,
                    attributes: {
                        exclude: ["password", "createdAt", "updatedAt"],
                    },
                },
            ],
            order: [
                ["date", "ASC"],
                ["time", "ASC"],
            ],
        });
        return res.status(201).json({
            status: "success",
            message: "Fetched all appointments successfully",
            data: appointments,
        });
    } catch (error) {
        console.error("All appointments error", error);
        res.status(500).json({
            message: "Failed to fetch all appointments",
            error: error.message,
        });
    }
};

// Confirms an appointment by updating its status
const confirmAppointment = async (req, res) => {
    try {
        const appointmentId = req.params.id;
        const body = req.body;

        const MentorProfile = await Mentor.findOne({
            where: { user_id: req.user.id },
            include: [{ model: User, as: "user", require: false }],
            attributes: { exclude: ["password"] },
        });

        if (!MentorProfile) {
            return res.status(404).json({
                status: "fail",
                message: `Mentor not found`,
            });
        }

        const appointment = await Appointment.findByPk(appointmentId);

        if (!appointment) {
            return res.status(404).json({
                status: "fail",
                message: "Appointment not found",
            });
        }

        appointment.status = body.status;

        await appointment.save();

        return res.status(201).json({
            status: "success",
            message: "appointment confirmed successfully",
            data: appointment,
        });
    } catch (error) {
        console.error("Confirm appointment error", error);
        res.status(500).json({
            message: "Failed to confirm appointment",
            error: error.message,
        });
    }
};
// Reschedules an appointment
const rescheduleAppointment = async (req, res) => {
    try {
        const appointmentId = req.params.id;
        const body = req.body;

        const MentorProfile = await Mentor.findOne({
            where: { user_id: req.user.id },
            include: [{ model: User, as: "user", require: false }],
            attributes: { exclude: ["password"] },
        });

        if (!MentorProfile) {
            return res.status(404).json({
                status: "fail",
                message: `Mentor not found`,
            });
        }

        const appointment = await Appointment.findByPk(appointmentId);

        if (!appointment) {
            return res.status(404).json({
                status: "fail",
                message: "Appointment not found",
            });
        }

        appointment.date = body.date;
        appointment.time = body.time;
        appointment.status = "pending";

        await appointment.save();

        return res.status(201).json({
            status: "success",
            message: "appointment rescheduled successfully",
            data: appointment,
        });
    } catch (error) {
        console.error("Reschedule appointment error", error);
        res.status(500).json({
            message: "Failed to reschedule appointment",
            error: error.message,
        });
    }
};

// Cancels an appointment
const cancelAppointment = async (req, res) => {
    try {
        const appointmentId = req.params.id;
        const body = req.body;

        const MentorProfile = await Mentor.findOne({
            where: { user_id: req.user.id },
            include: [{ model: User, as: "user", require: false }],
            attributes: { exclude: ["password"] },
        });

        if (!MentorProfile) {
            return res.status(404).json({
                status: "fail",
                message: `Mentor not found`,
            });
        }

        const appointment = await Appointment.findByPk(appointmentId);

        if (!appointment) {
            return res.status(404).json({
                status: "fail",
                message: "Appointment not found",
            });
        }

        appointment.status = body.status;

        await appointment.save();

        return res.status(201).json({
            status: "success",
            message: "appointment cancel successfully",
            data: appointment,
        });
    } catch (error) {
        console.error("Cancel appointment error", error);
        res.status(500).json({
            message: "Failed to cancel appointment",
            error: error.message,
        });
    }
};

// Deletes an appointment
const deleteAppointment = async (req, res) => {
    try {
        const appointmentId = req.params.id;

        const MentorProfile = await Mentor.findOne({
            where: { user_id: req.user.id },
            include: [{ model: User, as: "user", require: false }],
            attributes: { exclude: ["password"] },
        });

        if (!MentorProfile) {
            return res.status(404).json({
                status: "fail",
                message: `Mentor not found`,
            });
        }

        const appointment = await Appointment.findByPk(appointmentId);

        if (!appointment) {
            return res.status(404).json({
                status: "fail",
                message: "Appointment not found",
            });
        }

        await appointment.destroy();

        return res.status(201).json({
            status: "success",
            message: "appointment deleted successfully",
            data: appointment,
        });
    } catch (error) {
        console.error("Delete appointment error", error);
        res.status(500).json({
            message: "Failed to delete appointment",
            error: error.message,
        });
    }
};

module.exports = {
    getAllAppointments,
    cancelAppointment,
    rescheduleAppointment,
    confirmAppointment,
    deleteAppointment,
};
