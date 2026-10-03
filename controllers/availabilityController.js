const { respondError } = require('../utils/security');
const availabilityService = require('../services/availabilityService');
const Availability = require("../models/availability");


exports.createAvailability = async (req,res) => {
  try { const data = await availabilityService.create(req.user,req.body); res.status(201).json({message:"Availability created",data}); } catch(error) {respondError(res,error);}
};
// ✅ Get all availability for the logged-in mentor
exports.getMentorAvailability = async (req, res) => {
  try {
    const mentorId = req.user.id;
    const slots = await Availability.findAll({
      where: { mentorId },
      order: [["date", "ASC"]],
    });

    // 🧠 Filter out past dates (allow today and future)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingSlots = slots.filter((slot) => {
      const slotDate = new Date(slot.date);
      slotDate.setHours(0, 0, 0, 0);
      return slot.status === "available" && slotDate >= today;
    });

    return res.status(200).json({
      message: "Availability fetched successfully ✅",
      data: upcomingSlots || [],
    });
  } catch (error) {
    require('../utils/logger').error("Error fetching availability:", error);
    res.status(500).json({
      message: "Failed to fetch availability ❌",
    });
  }
};

// ✅ Update availability status or time
exports.updateAvailabilityStatus = async (req,res) => {
  try { const data = await availabilityService.change(req.user,req.params.id,req.body); res.status(200).json({message:"Availability updated",data}); } catch(error) {respondError(res,error);}
};
// ✅ (Optional) Delete availability slot
exports.deleteAvailability = async (req,res) => {
  try { const data = await availabilityService.change(req.user,req.params.id,{},true); res.status(200).json({message:"Availability deleted",data}); } catch(error) {respondError(res,error);}
};
// ✅ Get availability by mentor ID (for mentees to view)
exports.getAvailabilityByMentorId = async (req, res) => {
  try {
    const { mentorId } = req.params;

    if (!mentorId) {
      return res.status(400).json({ message: "Mentor ID is required ❌" });
    }

    // 🧠 Fetch all slots for this mentor
    const slots = await Availability.findAll({
      where: { mentorId },
      order: [["date", "ASC"]],
    });

    if (!slots.length) {
      return res.status(200).json({ 
        status: "success", 
        message: "No slots found", 
        data: [] 
      });
    }

    // 🧠 Get today's date for filtering
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ✅ Filter: only future + available slots
    const Mentor = require("../models/mentor");
    const Appointment = require("../models/appointment");
    
    const mentor = await Mentor.findOne({ where: { user_id: mentorId } });
    let dateCounts = {};
    if (mentor && mentor.maxSessionsPerDay) {
       const appointments = await Appointment.findAll({
          where: { mentorId: mentor.id, status: ["pending", "accepted", "completed"] }
       });
       appointments.forEach(app => {
          dateCounts[app.date] = (dateCounts[app.date] || 0) + 1;
       });
    }

    const availableFutureSlots = slots.filter((slot) => {
      const slotDate = new Date(slot.date);
      slotDate.setHours(0, 0, 0, 0);
      
      // If date is fully booked, hide it
      if (mentor && mentor.maxSessionsPerDay && dateCounts[slot.date] >= mentor.maxSessionsPerDay) {
         return false;
      }
      
      return slot.status === "available" && slotDate >= today;
    });

    if (!availableFutureSlots.length) {
      return res.status(200).json({ 
        status: "success", 
        message: "No available future slots found", 
        data: [] 
      });
    }

    // ✅ Format for frontend display
    const formatted = availableFutureSlots.map((slot) => ({
      id: slot.id,
      date: slot.date,
      day: slot.day,
      startTime: slot.startTime,
      endTime: slot.endTime,
      session_type: slot.session_type || 'fixed',
      session_title: slot.session_title || slot.title,
      topic_name: slot.topic_name,
      title: slot.title,
      price: slot.price,
      status: slot.status,
    }));

    return res.status(200).json({
      status: "success",
      message: "Available slots fetched successfully ✅",
      data: formatted,
    });
  } catch (error) {
    require('../utils/logger').error("Error fetching mentor availability:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch mentor availability ❌",
    });
  }
};
