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
    console.log("🔑 Logged-in mentee id:", req.user?.id);

    const mentors = await Mentor.findAll({
      include: [
        {
          model: User,
           as: "user",
          attributes: ["id", "name", "countryCode", "picture", "status", "userType"],
          where: { status: "approved", userType: "mentor" },
        },
      ],
    });

    const formatted = mentors.map((m) => ({
      id: m.id,
      user_id: m.user_id,
     user: {
  id: m.user?.id,
  name: m.user?.name || "Unknown",
  countryCode: m.user?.countryCode || "NG",
   picture: m.user?.picture || "http://localhost:5000/uploads/default.png",
},

      expertise: m.expertise ? JSON.parse(m.expertise) : [],
      yearsOfExperience: m.yearsOfExperience || 0,
      attendance: m.attendance || "0%",
      sessions: m.sessions || 0,
      reviews: m.reviews || 0,
    }));

    res.status(200).json({
      status: "success",
      results: formatted.length,
      data: formatted,
    });
  } catch (err) {
    console.error("❌ Error fetching mentors:", err);
    res.status(500).json({ status: "fail", message: "Server error" });
  }
};

// ✅ Fetch full details of a specific mentor (for mentee)
const getMentorsDetails = async (req, res) => {
  try {
    const id = req.params.id || req.query.id;
    if (!id) {
      return res.status(400).json({ status: "fail", message: "Mentor ID is required" });
    }

    const mentor = await Mentor.findOne({
      where: { id, status: "approved" },
      include: [
        {
          model: User,
           as: "user",
          attributes: [
            "id",
            "name",
            "email",
            "picture",
            "status",
            "userType",
            "role",
            "linkedinUrl",
            "countryCode",
          ],
        },
      ],
    });

    if (!mentor) {
      return res.status(404).json({ status: "fail", message: "Mentor not found" });
    }

    // Fetch mentor's available slots
    const availableSlots = await Availability.findAll({
      where: { mentorId: mentor.id },
      order: [
        ["date", "ASC"],
        ["time", "ASC"],
      ],
    });

    const profile = {
      id: mentor.id,
      user_id: mentor.user_id,
      name: mentor.User?.name || "Unknown",
      email: mentor.User?.email || "",
      picture: mentor.User?.picture || "images/default-avatar.png",
      status: mentor.User?.status || "",
      userType: mentor.User?.userType || "",
      role: mentor.User?.role || "",
      linkedinUrl: mentor.User?.linkedinUrl || "",
      countryCode: mentor.User?.countryCode || "NG",
      bio: mentor.bio || "",
      expertise: mentor.expertise ? JSON.parse(mentor.expertise) : [],
      disciplines: mentor.disciplines ? JSON.parse(mentor.disciplines) : [],
      education: mentor.education ? JSON.parse(mentor.education) : [],
      experience: mentor.experience ? JSON.parse(mentor.experience) : [],
      experienceDescription: mentor.experienceDescription || "",
      yearsOfExperience: mentor.yearsOfExperience || 0,
      attendance: mentor.attendance || "0%",
      availableSlots,
    };

    res.status(200).json({ status: "success", data: profile });
  } catch (err) {
    console.error("❌ Error fetching mentor profile:", err);
    res.status(500).json({ status: "fail", message: "Server error" });
  }
};

const { MentorCommendation } = require("../models");

// ✅ Fetch full details of a specific mentee (for mentor/public view)
const getMenteeProfileById = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ status: "fail", message: "Mentee ID is required" });

    // Try finding Mentee by mentee table id, or fallback to user_id
    let mentee = await Mentee.findOne({
      where: { id },
      include: [{ model: User, as: "user", attributes: ["id", "name", "picture", "email", "status", "userType", "countryCode"] }]
    });

    if (!mentee) {
      mentee = await Mentee.findOne({
         where: { user_id: id },
         include: [{ model: User, as: "user", attributes: ["id", "name", "picture", "email", "status", "userType", "countryCode"] }]
      });
    }

    if (!mentee) return res.status(404).json({ status: "fail", message: "Mentee not found" });

    // Appointments fetching for impact data
    const appointments = await Appointment.findAll({
      where: { menteeId: mentee.id }
    });

    let minutesLearned = 0;
    let completedCount = 0;
    let scheduledCount = 0;

    appointments.forEach(app => {
      if (app.status === 'completed' || app.status === 'accepted') scheduledCount++;
      if (app.status === 'completed') {
        completedCount++;
        minutesLearned += 60; // Fixed duration per user request
      }
    });

    const attendanceRate = scheduledCount > 0 ? Math.round((completedCount / scheduledCount) * 100) : 0;

    // Mentor Commendations
    let commendations = [];
    try {
      if (MentorCommendation) {
         commendations = await MentorCommendation.findAll({
            where: { menteeId: mentee.id },
            include: [{ model: Mentor, as: "mentor", include: [{ model: User, as: "user", attributes: ["name", "picture", "id"] }] }],
            order: [["createdAt", "DESC"]]
         });
      }
    } catch(e) {}

    const profileData = {
      ...mentee.toJSON(),
      role: mentee.role || "Mentee",
      name: mentee.user?.name || "Unknown",
      picture: mentee.user?.picture || "http://localhost:5000/uploads/default.png",
      countryCode: mentee.user?.countryCode || "NG",
      email: mentee.user?.email,
      impact: {
        sessionsAttended: completedCount,
        minutesLearned: minutesLearned,
        attendanceRate: attendanceRate
      },
      commendations
    };

    res.status(200).json({ status: "success", data: profileData });
  } catch (err) {
    console.error("error fetching mentee", err);
    res.status(500).json({ status: "fail", message: "Server error" });
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
    getMenteeProfileById,
    bookApppointment,
    resceduleAppointment,
    cancelAppointment,
    deleteAppointment,
    apppointmentLists,
};
