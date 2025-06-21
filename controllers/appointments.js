const {
    Appointment,
    User,
    Mentee,
    Mentor,
    ChatAccess,
    Availability,
} = require("../models");
const { generateAccessCode } = require("../utils/generateaccesscode");

// Retrieves all appointments for the logged-in mentor
const getAllAppointments = async (req, res) => {
    try {
        const user = req.user;

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

        if (appointments.length === 0) {
            return res.status(404).json({
                status: "fail",
                message: "No appointments found",
            });
        }

        if (user.id !== MentorProfile.id) {
            return res.status(403).json({
                status: "fail",
                message: "You are not authorized to view this appointment",
            });
        }
        return res.status(201).json({
            status: "success",
            message: "Fetched all appointments successfully",
            data: appointments,
        });
    } catch (error) {
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
        const user = req.user;

        const MentorProfile = await Mentor.findOne({
            where: { user_id: req.user.id },
            include: [
                {
                    model: User,
                    as: "user",
                    attributes: ["name"],
                    require: false,
                },
            ],
            attributes: { exclude: ["password"] },
        });

        if (!MentorProfile) {
            return res.status(404).json({
                status: "fail",
                message: `Mentor not found`,
            });
        }

        if (user.id !== MentorProfile.user_id) {
            return res.status(403).json({
                status: "fail",
                message: "You are not authorized to confirm this appointment",
            });
        }

        const appointment = await Appointment.findByPk(appointmentId);

        if (!appointment) {
            return res.status(404).json({
                status: "fail",
                message: "Appointment not found",
            });
        }

        const mentorfullName = MentorProfile.user?.name;

        const firstname = mentorfullName
            .split(" ")[0]
            .toLowerCase()
            .replace(/[^a-z]/g, "");

        generatedAccessCode = generateAccessCode(firstname);

        appointment.status = body.status;
        appointment.accessCode = generatedAccessCode;

        // await appointment.save();

        const chatAccess = await ChatAccess.findOne({
            where: { bookingId: appointment.id },
        });

        if (chatAccess) {
            return res.status(404).json({
                status: "fail",
                message: `Chat acces code exist`,
            });
        }

        const newChatAccess = await ChatAccess.create({
            bookingId: appointment.id,
            accessCode: generatedAccessCode,
            mentorId: MentorProfile.id,
            menteeId: appointment.menteeId,
        });

        return res.status(201).json({
            status: "success",
            message: "appointment confirmed successfully",
            data: { appointment, newChatAccess },
        });
    } catch (error) {
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
        const user = req.user;

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

        if (user.id !== appointment.mentorId) {
            return res.status(401).json({
                status: "fail",
                message:
                    "You are not authorized to reschedule this appointment",
            });
        }

        appointment.date = body.date;
        appointment.time = body.time;
        appointment.status = "pending";
        appointment.accessCode = null;

        await appointment.save();

        return res.status(201).json({
            status: "success",
            message: "appointment rescheduled successfully",
            data: appointment,
        });
    } catch (error) {
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
        const user = req.user;

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

        if (user.id !== appointment.menteeId) {
            return res.status(403).json({
                status: "fail",
                message: "You are not authorized to cancel this appointment",
            });
        }

        appointment.status = body.status;
        appointment.accessCode = null;

        await appointment.save();

        return res.status(201).json({
            status: "success",
            message: "appointment cancel successfully",
            data: appointment,
        });
    } catch (error) {
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
        const user_id = req.user.id;

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

        if (user_id !== MentorProfile.id) {
            return res.status(404).json({
                status: "fail",
                message: `You are not authorized to delete this appointment`,
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
        res.status(500).json({
            message: "Failed to delete appointment",
            error: error.message,
        });
    }
};

// Add available dates and times
async function addAvailableDate(req, res) {
    try {
        const body = req.body;
        const user = req.user;

        if (!user) {
            return res.status(404).json({
                status: "fail",
                message: `User not found`,
            });
        }

        const entries = await Availability.create({
            mentorId: user.id,
            date: body.date,
            time: body.time,
        });

        return res.status(200).json({
            status: "success",
            message: "Available date added successfully",
            entries: entries,
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to add available date",
            error: error.message,
        });
    }
}

// Get all available dates and times
async function getAllAvailabilityDate(req, res) {
    try {
        const user = req.user;

        if (!user) {
            return res.status(404).json({
                status: "fail",
                message: `User not found`,
            });
        }

        const entries = await Availability.findAll({
            where: { mentorId: user.id },
        });

        if (entries.length === 0) {
            return res.status(404).json({
                status: "fail",
                message: "No available dates yet create one",
            });
        }

        return res.status(200).json({
            status: "success",
            message: "Available date fetched successfully",
            entries: entries,
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to fetche aavailability",
            error: error.message,
        });
    }
}

// update availability
async function updateAvailability(req, res) {
    try {
        const { date, time } = req.body;
        const availabilityId = req.params.id;
        const user = req.user;

        if (!user) {
            return res.status(500).json({
                message: "User not found",
            });
        }

        const availability = await Availability.findByPk(availabilityId);

        if (!availability) {
            return res.status(404).json({
                status: "fail",
                message: "Availability not found",
            });
        }

        if (user.id !== availability.mentorId) {
            return res.status(403).json({
                status: "fail",
                message: "You are not authorized to update this availability",
            });
        }

        if (date) availability.date = date;
        if (time) availability.time = time;

        await availability.save();

        return res.status(200).json({
            status: "success",
            message: "Availability updated successfully",
            data: availability,
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to update aavailability",
            error: error.message,
        });
    }
}

// delete availability
async function deleteAvailability(req, res) {
    try {
        const user = req.user;
        const availabilityId = req.params.id;

        if (!user) {
            return res.status(404).json({
                status: "fail",
                message: `User not found`,
            });
        }

        const availability = await Availability.findByPk(availabilityId);

        if (!availability) {
            return res.status(404).json({
                status: "fail",
                message: "Availability not found",
            });
        }

        if (availability.userId !== user.id) {
            return res.status(404).json({
                status: "fail",
                message: "You are not authorized to delete this availability",
            });
        }
        await availability.destroy();
        return res.status(200).json({
            status: "success",
            message: "Availability deleted successfully",
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to delete aavailability",
            error: error.message,
        });
    }
}

module.exports = {
    getAllAppointments,
    cancelAppointment,
    rescheduleAppointment,
    confirmAppointment,
    deleteAppointment,
    addAvailableDate,
    getAllAvailabilityDate,
    deleteAvailability,
    updateAvailability,
};
