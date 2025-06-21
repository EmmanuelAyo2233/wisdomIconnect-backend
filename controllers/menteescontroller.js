const {
    User,
    Mentor,
    Appointment,
    Mentee,
    Availability,
} = require("../models");

// Retrieves a list of all available mentors
const getAllMentors = async (req, res) => {
    try {
        const mentors = await Mentor.findAll({
            include: [
                {
                    model: User,
                    as: "user",
                    required: false,
                    attributes: { exclude: ["password"] },
                },
            ],
        });
        return res.status(201).json({
            status: "success",
            message: "All mentors fetched successfully",
            data: mentors,
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch all mentors",
            error: error.message,
        });
    }
};

// Retrieves details for a specific mentor
const getMentorsDetails = async (req, res) => {
    try {
        const id = req.params.id || req.query.id;
        const email = req.params.email || req.query.email;

        if (!id && !email) {
            return res.status(400).json({
                status: "fail",
                message: "Please provide either mentor ID or email",
            });
        }

        const whereClause = {};

        if (id) whereClause.id = id;
        if (email) whereClause.email = email;

        const mentor = await Mentor.findOne({
            where: whereClause,
            include: [
                {
                    model: User,
                    as: "user",
                    attributes: { exclude: ["password"] },
                },
            ],
        });

        if (!mentor) {
            return res.status(404).json({
                status: "fail",
                message: "Mentor not found",
            });
        }

        const slot = await Availability.findAll({
            where: { mentorId: mentor.id },
            order: [
                ["date", "ASC"],
                ["time", "ASC"],
            ],
        });

        return res.status(201).json({
            status: "success",
            message: "mentors details",
            data: { mentor, avalableSlots: slot },
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to load mentor details",
            error: error.message,
        });
    }
};

// Allows a mentee to book an appointment with a mentor
const bookApppointment = async (req, res) => {
    try {
        const { id: mentorId } = req.params;
        const body = req.body;

        const menteeId = req.user.id;

        const mentor = await User.findOne({
            where: { id: mentorId, userType: "mentor" },
            include: [{ model: Mentor, as: "mentor", required: false }],
            attributes: { exclude: ["password"] },
        });

        if (!mentor) {
            return res.status(404).json({
                status: "fail",
                message: "Mentor not found",
            });
        }

        const mentee = await User.findOne({
            where: { id: menteeId },
            include: [{ model: Mentee, as: "mentee", required: false }],
            attributes: { exclude: ["password"] },
        });

        if (!mentee) {
            return res.status(404).json({
                status: "fail",
                message: "Mentee profile not found",
            });
        }

        const appointment = await Appointment.create({
            menteeId: mentee.mentee.id,
            mentorId: mentor.mentor.id,
            date: body.date,
            time: body.time,
        });

        return res.status(201).json({
            status: "success",
            message: "Appointment Booked with Mentor",
            data: appointment,
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to book appointment",
            error: error.message,
        });
    }
};

// Allows a mentee to list all appointments
const apppointmentLists = async (req, res) => {
    try {
        const menteeId = req.user.id;

        const appointment = await Appointment.findAll({
            where: { menteeId },
        });

        if (appointment.length === 0) {
            return res.status(404).json({
                status: "fail",
                message: "No appointment found",
            });
        }
        return res.status(201).json({
            status: "success",
            message: "Booked appointments fetched",
            data: appointment,
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to lisr all appointments",
            error: error.message,
        });
    }
};

// Allows mentee to reschedule an appointment
const resceduleAppointment = async (req, res) => {
    try {
        const appointmentId = req.params.id;
        const body = req.body;
        const menteeId = req.user.id;

        const appointment = await Appointment.findOne({
            where: { id: appointmentId, menteeId },
        });

        if (!appointment) {
            return res.status(404).json({
                status: "fail",
                message: "Appointment not found",
            });
        }

        appointment.date = body.date || appointment.date;
        appointment.time = body.time || appointment.time;
        appointment.status = "pending";

        appointment.save();

        return res.status(201).json({
            status: "success",
            message: "Appointment Reschdeuled with Mentor",
            data: appointment,
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to reschedule appointment",
            error: error.message,
        });
    }
};

// Allows a mentee to cancel an appointment
const cancelAppointment = async (req, res) => {
    try {
        const appointmentId = req.params.id;
        const body = req.body;
        const menteeId = req.user.id;

        const appointment = await Appointment.findOne({
            where: { id: appointmentId, menteeId },
        });

        if (!appointment) {
            return res.status(404).json({
                status: "fail",
                message: "Appointment not found",
            });
        }

        appointment.status = body.status;

        appointment.save();

        return res.status(201).json({
            status: "success",
            message: "Appointment Cancelled with Mentor name",
            data: appointment,
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to cancel appointment",
            error: error.message,
        });
    }
};

// Allows a mentee to delete an appointment
const deleteAppointment = async (req, res) => {
    try {
        const appointmentId = req.params.id;
        const body = req.body;
        const menteeId = req.user.id;

        const appointment = await Appointment.findOne({
            where: { id: appointmentId, menteeId },
        });

        if (!appointment) {
            return res.status(404).json({
                status: "fail",
                message: "Appointment not found",
            });
        }

        await appointment.destroy();

        return res.status(201).json({
            status: "success",
            message: "Appointment deleted succefully",
            data: appointment,
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to delete appointment",
            error: error.message,
        });
    }
};

module.exports = {
    getAllMentors,
    getMentorsDetails,
    bookApppointment,
    resceduleAppointment,
    cancelAppointment,
    deleteAppointment,
    apppointmentLists,
};
