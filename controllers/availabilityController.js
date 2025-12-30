const Availability = require("../models/availability");


exports.createAvailability = async (req, res) => {
  try {
    const { date, day, startTime, endTime, status } = req.body;
    const mentorId = req.user.id;

    // 🔒 Check required fields
    if (!date || !startTime || !endTime) {
      return res.status(400).json({ message: "Please provide date, startTime, and endTime ❌" });
    }

    const today = new Date();
    const selectedDate = new Date(date);

    // ⛔ Block past or current dates
    if (selectedDate <= today.setHours(0, 0, 0, 0)) {
      return res.status(400).json({ message: "You cannot set availability for today or past dates ❌" });
    }

    // ⛔ Prevent duplicate slots (same date & time for same mentor)
    const existingSlot = await Availability.findOne({
      where: { mentorId, date, startTime, endTime },
    });

    if (existingSlot) {
      return res.status(400).json({ message: "This time slot is already set ❌" });
    }

    // ✅ Create availability
    const slot = await Availability.create({
      mentorId,
      date,
      day,
      startTime,
      endTime,
      status: status || "available",
    });

    return res.status(201).json({
      message: "Availability created successfully ✅",
      data: slot,
    });
  } catch (error) {
    console.error("Error creating availability:", error);
    res.status(500).json({
      message: "Failed to create availability ❌",
      error: error.message,
    });
  }
};

// ✅ Get all availability for the logged-in mentor
exports.getMentorAvailability = async (req, res) => {
  try {
    const mentorId = req.user.id;
    const slots = await Availability.findAll({
      where: { mentorId },
      order: [["date", "ASC"]],
    });

    // 🧠 Filter out past and current dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingSlots = slots.filter((slot) => {
      const slotDate = new Date(slot.date);
      slotDate.setHours(0, 0, 0, 0);
      return slotDate > today;
    });

    return res.status(200).json({
      message: "Availability fetched successfully ✅",
      data: upcomingSlots || [],
    });
  } catch (error) {
    console.error("Error fetching availability:", error);
    res.status(500).json({
      message: "Failed to fetch availability ❌",
      error: error.message,
    });
  }
};

// ✅ Update availability status or time
exports.updateAvailabilityStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, startTime, endTime, date } = req.body;

    const slot = await Availability.findByPk(id);
    if (!slot) {
      return res.status(404).json({ message: "Availability slot not found ❌" });
    }

    await slot.update({
      status: status || slot.status,
      startTime: startTime || slot.startTime,
      endTime: endTime || slot.endTime,
      date: date || slot.date,
    });

    res.status(200).json({
      message: "Availability updated successfully ✅",
      data: slot,
    });
  } catch (error) {
    console.error("Error updating availability:", error);
    res.status(500).json({
      message: "Failed to update availability ❌",
      error: error.message,
    });
  }
};

// ✅ (Optional) Delete availability slot
exports.deleteAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const slot = await Availability.findByPk(id);
    if (!slot) {
      return res.status(404).json({ message: "Availability not found ❌" });
    }

    await slot.destroy();
    res.status(200).json({ message: "Availability deleted successfully ✅" });
  } catch (error) {
    console.error("Error deleting availability:", error);
    res.status(500).json({
      message: "Failed to delete availability ❌",
      error: error.message,
    });
  }
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
      return res.status(404).json({ message: "No slots found ❌" });
    }

    // 🧠 Get today's date for filtering
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ✅ Filter: only future + available slots
    const availableFutureSlots = slots.filter((slot) => {
      const slotDate = new Date(slot.date);
      slotDate.setHours(0, 0, 0, 0);
      return slot.status === "available" && slotDate > today;
    });

    if (!availableFutureSlots.length) {
      return res.status(404).json({ message: "No available future slots found ❌" });
    }

    // ✅ Format for frontend display
    const formatted = availableFutureSlots.map((slot) => ({
      id: slot.id,
      date: slot.date,
      day: slot.day,
      startTime: slot.startTime,
      endTime: slot.endTime,
      status: slot.status,
    }));

    return res.status(200).json({
      status: "success",
      message: "Available slots fetched successfully ✅",
      data: formatted,
    });
  } catch (error) {
    console.error("Error fetching mentor availability:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch mentor availability ❌",
      error: error.message,
    });
  }
};
