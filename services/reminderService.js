'use strict';

/**
 * reminderService.js
 * 
 * Polls the database every minute and sends email + in-app notifications:
 *  - 24 hours before a scheduled call
 *  - 1 hour before a scheduled call
 *  - 10 minutes before a scheduled call
 * 
 * Each reminder is sent only once per appointment using a Set of sent IDs
 * stored in memory. This is production-safe because reminders for future
 * appointments are re-evaluated on each server restart.
 */

const { Op } = require('sequelize');
const notificationService = require('./notificationService');

// Lazy-load models to avoid circular deps at startup
function getModels() {
  const { Appointment, Mentor, Mentee, User } = require('../models');
  return { Appointment, Mentor, Mentee, User };
}

// Track which (appointmentId, window) combos have already been notified this session
const notified = {
  '24h': new Set(),
  '1h':  new Set(),
  '10m': new Set(),
};

/**
 * Format a JS Date to a readable time string, e.g. "3:00 PM WAT"
 */
function formatTime(date) {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  });
}

/**
 * Format a JS Date to a readable date string, e.g. "Wed, Aug 14, 2026"
 */
function formatDate(date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Parse an appointment's date + startTime into a JS Date in UTC.
 * DB stores date as "YYYY-MM-DD" and startTime as "HH:MM:SS".
 */
function getStartDateTime(appointment) {
  const dateStr = appointment.date; // "2026-08-14"
  const timeStr = appointment.startTime; // "15:00:00"
  return new Date(`${dateStr}T${timeStr}Z`);
}

/**
 * Send reminders to both mentor and mentee for a given appointment.
 */
async function sendReminderForAppointment(appointment, window) {
  try {
    const mentorProfile = appointment.mentor;
    const menteeProfile = appointment.mentee;
    const mentorUser    = mentorProfile && mentorProfile.user;
    const menteeUser    = menteeProfile && menteeProfile.user;
    const sessionTitle  = appointment.topic || 'Mentorship Session';
    const meetingId     = appointment.meetingId || appointment.id;

    const startAt  = getStartDateTime(appointment);
    const dateStr  = formatDate(startAt);
    const timeStr  = formatTime(startAt);

    const mentorName = mentorUser ? (mentorUser.name || mentorUser.firstName || 'Your mentor') : 'Your mentor';
    const menteeName = menteeUser ? (menteeUser.name || menteeUser.firstName || 'Your mentee') : 'Your mentee';

    // Build notification receiver objects using profile IDs (required by notificationService)
    // but keep email from the user record for email delivery.
    const menteeReceiver = menteeProfile ? {
      id:        menteeProfile.id,   // Mentee profile ID for in-app notifications
      email:     menteeUser ? menteeUser.email : null,
      name:      menteeUser ? (menteeUser.name || menteeUser.firstName) : 'User',
      firstName: menteeUser ? menteeUser.firstName : null,
    } : null;

    const mentorReceiver = mentorProfile ? {
      id:        mentorProfile.id,   // Mentor profile ID for in-app notifications
      email:     mentorUser ? mentorUser.email : null,
      name:      mentorUser ? (mentorUser.name || mentorUser.firstName) : 'User',
      firstName: mentorUser ? mentorUser.firstName : null,
    } : null;

    // Send to Mentee
    if (menteeUser && menteeUser.email) {
      if (window === '24h') {
        await notificationService.sendSessionReminder24h(menteeUser, 'mentee', mentorName, sessionTitle, dateStr, timeStr, meetingId);
      } else if (window === '1h') {
        await notificationService.sendSessionReminder1h(menteeUser, 'mentee', mentorName, sessionTitle, timeStr, meetingId);
      } else if (window === '10m') {
        await notificationService.sendSessionReminder10m(menteeUser, 'mentee', mentorName, sessionTitle, timeStr, meetingId);
      }
    }

    // Send to Mentor
    if (mentorUser && mentorUser.email) {
      if (window === '24h') {
        await notificationService.sendSessionReminder24h(mentorUser, 'mentor', menteeName, sessionTitle, dateStr, timeStr, meetingId);
      } else if (window === '1h') {
        await notificationService.sendSessionReminder1h(mentorUser, 'mentor', menteeName, sessionTitle, timeStr, meetingId);
      } else if (window === '10m') {
        await notificationService.sendSessionReminder10m(mentorUser, 'mentor', menteeName, sessionTitle, timeStr, meetingId);
      }
    }

    notified[window].add(appointment.id);
    console.log(`✅ [Reminder:${window}] Sent for appointment ${appointment.id}`);
  } catch (err) {
    console.error(`❌ [Reminder:${window}] Failed for appointment ${appointment.id}:`, err.message);
  }
}

/**
 * Core poll function — called every minute.
 */
async function pollReminders() {
  try {
    const { Appointment, Mentor, Mentee, User } = getModels();
    const now = new Date();

    // Look ahead 25 hours to capture all relevant windows in one query
    const lookAhead = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    const appointments = await Appointment.findAll({
      where: {
        status: { [Op.in]: ['booked', 'confirmed', 'accepted'] },
      },
      include: [
        { model: Mentor, as: 'mentor', include: [{ model: User, as: 'user' }] },
        { model: Mentee, as: 'mentee', include: [{ model: User, as: 'user' }] },
      ],
    });

    for (const appt of appointments) {
      const startAt = getStartDateTime(appt);
      const diffMs  = startAt.getTime() - now.getTime();
      const diffMin = diffMs / (1000 * 60);

      // Skip already-started or past appointments
      if (diffMin < 0) continue;

      // 24-hour window: between 23h55m and 24h05m before start
      if (diffMin >= 23 * 60 + 55 && diffMin <= 24 * 60 + 5 && !notified['24h'].has(appt.id)) {
        await sendReminderForAppointment(appt, '24h');
      }

      // 1-hour window: between 55min and 65min before start
      if (diffMin >= 55 && diffMin <= 65 && !notified['1h'].has(appt.id)) {
        await sendReminderForAppointment(appt, '1h');
      }

      // 10-minute window: between 8min and 12min before start
      if (diffMin >= 8 && diffMin <= 12 && !notified['10m'].has(appt.id)) {
        await sendReminderForAppointment(appt, '10m');
      }
    }
  } catch (err) {
    console.error('❌ [ReminderService] Poll error:', err.message);
  }
}

/**
 * Start the reminder scheduler (polls every 60 seconds).
 */
function start() {
  console.log('⏰ [ReminderService] Started — polling every 60 seconds');
  // Run once immediately on start, then repeat every minute
  pollReminders();
  setInterval(pollReminders, 60 * 1000);
}

module.exports = { start };
