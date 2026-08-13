const Notification = require('../models/notification');
const emailService = require('./emailService');
const templates = require('../utils/emailTemplates');

/**
 * Core Notification Service to handle sending both in-app and email notifications.
 */
class NotificationService {

  /**
   * Helper to robustly resolve User object (with email) and profileId (Mentor.id or Mentee.id).
   */
  async resolveUserAndProfile(target, type) {
    const User = require('../models/user');
    const Mentor = require('../models/mentor');
    const Mentee = require('../models/mentee');

    let userRecord = null;
    let profileId = null;

    if (!target) return { user: null, profileId: null };

    // If target is an object with email
    if (target.email) {
      userRecord = target;
      if (type === 'mentor') {
        const m = target.mentor || await Mentor.findOne({ where: { user_id: target.id } });
        profileId = m ? m.id : target.id;
      } else if (type === 'mentee') {
        const me = target.mentee || await Mentee.findOne({ where: { user_id: target.id } });
        profileId = me ? me.id : target.id;
      } else {
        profileId = target.id;
      }
      return { user: userRecord, profileId };
    }

    // If target is Mentor or Mentee instance (has user_id but no email directly attached)
    if (target.user_id) {
      profileId = target.id;
      userRecord = await User.findByPk(target.user_id);
      return { user: userRecord, profileId };
    }

    // If target is a raw ID (number or numeric string)
    if (typeof target === 'number' || (typeof target === 'string' && !isNaN(target))) {
      const numericId = Number(target);
      if (type === 'mentor') {
        const m = await Mentor.findByPk(numericId, { include: [{ model: User, as: 'user' }] });
        if (m && m.user) {
          return { user: m.user, profileId: m.id };
        }
      } else if (type === 'mentee') {
        const me = await Mentee.findByPk(numericId, { include: [{ model: User, as: 'user' }] });
        if (me && me.user) {
          return { user: me.user, profileId: me.id };
        }
      }
      // Fallback: try User directly
      userRecord = await User.findByPk(numericId);
      profileId = numericId;
    }

    return { user: userRecord, profileId };
  }

  /**
   * Helper to parse string or object sessionDetails into topic & dateTime strings.
   */
  parseSessionDetails(sessionDetails) {
    let topic = 'Mentorship Session';
    let dateTime = '';

    if (!sessionDetails) return { topic, dateTime };

    if (typeof sessionDetails === 'object') {
      topic = sessionDetails.topic || sessionDetails.sessionTitle || 'Mentorship Session';
      dateTime = sessionDetails.dateTime || `${sessionDetails.date || ''} ${sessionDetails.startTime || ''}`.trim();
    } else if (typeof sessionDetails === 'string') {
      const lines = sessionDetails.split('\n');
      let datePart = '', timePart = '';
      lines.forEach(line => {
        const lower = line.toLowerCase();
        if (lower.startsWith('topic:')) topic = line.substring(line.indexOf(':') + 1).trim();
        if (lower.startsWith('date:')) datePart = line.substring(line.indexOf(':') + 1).trim();
        if (lower.startsWith('time:')) timePart = line.substring(line.indexOf(':') + 1).trim();
      });
      if (datePart || timePart) {
        dateTime = `${datePart} ${timePart}`.trim();
      } else {
        dateTime = sessionDetails;
      }
    }

    return { topic, dateTime };
  }

  /**
   * General method to create a notification and optionally send an email.
   */
  async sendNotification({ 
    receiverId, 
    receiverType, // 'mentor' or 'mentee'
    senderId = null, 
    type = 'system', 
    title, 
    message, 
    link = null,
    emailData = null 
  }) {
    try {
      // 1. Save In-App Notification to DB
      const inAppNotif = await Notification.create({
        receiverId,
        receiverType,
        senderId,
        type,
        title,
        message,
        link,
        isRead: false
      });

      // 2. Send Email if emailData is provided and recipient has an email address
      if (emailData && emailData.to) {
        await emailService.sendEmail({
          to: emailData.to,
          subject: title || 'New Notification from Wisicom',
          html: emailData.html
        });
      } else if (emailData) {
        console.warn('⚠️ [sendNotification] emailData provided but recipient email ("to") is missing:', emailData);
      }

      return inAppNotif;
    } catch (error) {
      console.error('Error in sendNotification:', error);
      throw new Error('Failed to send notification');
    }
  }

  // ==========================================
  // AUTHENTICATION & ACCOUNT EVENTS
  // ==========================================

  async sendEmailVerification(user, otp) {
    if (!user || !user.email) return;
    await emailService.sendEmail({
      to: user.email,
      subject: 'Verify your email address',
      html: templates.emailVerification(user.firstName || user.name || 'User', otp)
    });
  }

  async sendWelcomeNotification(user, userType) {
    const { user: userRecord, profileId } = await this.resolveUserAndProfile(user, userType);
    if (!userRecord || !userRecord.email) return;

    await this.sendNotification({
      receiverId: profileId || userRecord.id,
      receiverType: userType,
      type: 'auth',
      title: 'Welcome to Wisicom!',
      message: 'Your account has been successfully created. Explore the platform and connect with others!',
      emailData: {
        to: userRecord.email,
        html: templates.welcomeEmail(userRecord.firstName || userRecord.name || 'User')
      }
    });
  }

  async sendPasswordReset(user, token) {
    if (!user || !user.email) return;
    const url = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    await emailService.sendEmail({
      to: user.email,
      subject: 'Reset your password',
      html: templates.passwordReset(user.firstName || user.name || 'User', url)
    });
  }

  // ==========================================
  // MESSAGING EVENTS
  // ==========================================

  async sendMessageRequest(sender, receiver, receiverType) {
    const { user: senderUser, profileId: senderProfileId } = await this.resolveUserAndProfile(sender, receiverType === 'mentor' ? 'mentee' : 'mentor');
    const { user: receiverUser, profileId: receiverProfileId } = await this.resolveUserAndProfile(receiver, receiverType);
    
    if (!receiverUser || !receiverUser.email) {
      console.error('❌ sendMessageRequest failed: Receiver email not found');
      return;
    }

    const messageUrl = `${process.env.FRONTEND_URL}/${receiverType}/messages`;
    const senderName = senderUser ? (senderUser.firstName || senderUser.name) : 'A User';
    const receiverName = receiverUser.firstName || receiverUser.name || 'User';

    await this.sendNotification({
      receiverId: receiverProfileId || receiverUser.id,
      receiverType,
      senderId: senderProfileId || (senderUser ? senderUser.id : null),
      type: 'message_request',
      title: 'New Connection Request',
      message: `You have a new connection request from ${senderName}.`,
      link: `/${receiverType}/messages`,
      emailData: {
        to: receiverUser.email,
        html: templates.messageRequest(receiverName, senderName, messageUrl)
      }
    });
  }

  async sendMessageRequestAccepted(sender, receiver, senderType) {
    const { user: senderUser, profileId: senderProfileId } = await this.resolveUserAndProfile(sender, senderType);
    const { user: receiverUser, profileId: receiverProfileId } = await this.resolveUserAndProfile(receiver, senderType === 'mentor' ? 'mentee' : 'mentor');

    if (!senderUser || !senderUser.email) {
      console.error('❌ sendMessageRequestAccepted failed: Sender email not found');
      return;
    }

    const chatUrl = `${process.env.FRONTEND_URL}/${senderType}/messages`;
    const senderName = senderUser.firstName || senderUser.name || 'User';
    const receiverName = receiverUser ? (receiverUser.firstName || receiverUser.name) : 'User';

    await this.sendNotification({
      receiverId: senderProfileId || senderUser.id,
      receiverType: senderType,
      senderId: receiverProfileId || (receiverUser ? receiverUser.id : null),
      type: 'message_request_response',
      title: 'Connection Request Accepted',
      message: `${receiverName} has accepted your connection request.`,
      link: `/${senderType}/messages`,
      emailData: {
        to: senderUser.email,
        html: templates.messageRequestAccepted(senderName, receiverName, chatUrl)
      }
    });
  }

  // ==========================================
  // BOOKING EVENTS
  // ==========================================

  async sendBookingRequest(mentee, mentor, sessionDetails) {
    const { user: menteeUser, profileId: menteeProfileId } = await this.resolveUserAndProfile(mentee, 'mentee');
    const { user: mentorUser, profileId: mentorProfileId } = await this.resolveUserAndProfile(mentor, 'mentor');

    if (!mentorUser || !mentorUser.email) {
      console.error('❌ sendBookingRequest failed: Mentor email not found', { mentor, mentorUser });
      return;
    }

    const dashboardUrl = `${process.env.FRONTEND_URL}/mentor/dashboard`;
    const menteeName = menteeUser ? (menteeUser.firstName || menteeUser.name) : 'A Mentee';
    const mentorName = mentorUser.firstName || mentorUser.name || 'Mentor';

    const { topic, dateTime } = this.parseSessionDetails(sessionDetails);

    await this.sendNotification({
      receiverId: mentorProfileId || mentorUser.id,
      receiverType: 'mentor',
      senderId: menteeProfileId || (menteeUser ? menteeUser.id : null),
      type: 'booking',
      title: 'New Booking Request',
      message: `${menteeName} has requested a mentorship session with you.`,
      link: '/mentor/bookings',
      emailData: {
        to: mentorUser.email,
        html: templates.bookingRequestSent(mentorName, menteeName, topic, dateTime, dashboardUrl)
      }
    });
  }

  async sendBookingAccepted(mentee, mentor, sessionDetails, meetingLink) {
    const { user: menteeUser, profileId: menteeProfileId } = await this.resolveUserAndProfile(mentee, 'mentee');
    const { user: mentorUser, profileId: mentorProfileId } = await this.resolveUserAndProfile(mentor, 'mentor');

    if (!menteeUser || !menteeUser.email) {
      console.error('❌ sendBookingAccepted failed: Mentee email not found', { mentee, menteeUser });
      return;
    }

    const joinUrl = `${process.env.FRONTEND_URL}${meetingLink || '/mentee/sessions'}`;
    const menteeName = menteeUser.firstName || menteeUser.name || 'Mentee';
    const mentorName = mentorUser ? (mentorUser.firstName || mentorUser.name) : 'Your Mentor';

    const { topic, dateTime } = this.parseSessionDetails(sessionDetails);

    await this.sendNotification({
      receiverId: menteeProfileId || menteeUser.id,
      receiverType: 'mentee',
      senderId: mentorProfileId || (mentorUser ? mentorUser.id : null),
      type: 'booking',
      title: 'Booking Accepted!',
      message: `${mentorName} has accepted your session request.`,
      link: '/mentee/bookings',
      emailData: {
        to: menteeUser.email,
        html: templates.bookingAccepted(menteeName, mentorName, topic, dateTime, joinUrl)
      }
    });
  }

  // ==========================================
  // PAYMENT & TRANSACTION EVENTS
  // ==========================================

  async sendPaymentSuccess(user, userType, amount, purpose) {
    const { user: userRecord, profileId } = await this.resolveUserAndProfile(user, userType);
    if (!userRecord || !userRecord.email) return;

    await this.sendNotification({
      receiverId: profileId || userRecord.id,
      receiverType: userType,
      type: 'payment',
      title: 'Payment Successful',
      message: `Your payment of ${amount} for ${purpose} was successful.`,
      emailData: {
        to: userRecord.email,
        html: templates.paymentSuccess(userRecord.firstName || userRecord.name || 'User', amount, purpose)
      }
    });
  }

  async sendWithdrawalRequested(mentor, amount) {
    const { user: mentorUser, profileId } = await this.resolveUserAndProfile(mentor, 'mentor');
    if (!mentorUser || !mentorUser.email) return;

    await this.sendNotification({
      receiverId: profileId || mentorUser.id,
      receiverType: 'mentor',
      type: 'payment',
      title: 'Withdrawal Request Received',
      message: `Your withdrawal request of ${amount} has been received and is being processed. You'll be notified once it's complete.`,
      emailData: {
        to: mentorUser.email,
        html: templates.withdrawalRequested(mentorUser.firstName || mentorUser.name || 'Mentor', amount)
      }
    });
  }

  async sendPayoutProcessed(mentor, amount) {
    const { user: mentorUser, profileId } = await this.resolveUserAndProfile(mentor, 'mentor');
    if (!mentorUser || !mentorUser.email) return;

    await this.sendNotification({
      receiverId: profileId || mentorUser.id,
      receiverType: 'mentor',
      type: 'payment',
      title: 'Payout Transferred Successfully',
      message: `Your payout of ${amount} has been approved and transferred to your bank account.`,
      emailData: {
        to: mentorUser.email,
        html: templates.payoutProcessed(mentorUser.firstName || mentorUser.name || 'Mentor', amount)
      }
    });
  }

  // ==========================================
  // SESSION CALL REMINDERS (1 Day, 1 Hour, 10 Mins)
  // ==========================================

  async sendSessionReminder24h(user, userType, otherPersonName, sessionTitle, dateStr, timeStr, meetingId) {
    const { user: userRecord, profileId } = await this.resolveUserAndProfile(user, userType);
    if (!userRecord || !userRecord.email) return;

    const joinUrl = `${process.env.FRONTEND_URL || 'https://wisdom-iconnect.vercel.app'}/call/${meetingId}`;
    await this.sendNotification({
      receiverId: profileId || userRecord.id,
      receiverType: userType,
      type: 'booking',
      title: 'Call Reminder: Tomorrow',
      message: `Reminder: Your mentorship call with ${otherPersonName} is scheduled for tomorrow at ${timeStr}.`,
      link: `/call/${meetingId}`,
      emailData: {
        to: userRecord.email,
        html: templates.reminder24h(userRecord.firstName || userRecord.name || 'User', otherPersonName, sessionTitle, dateStr, timeStr, joinUrl)
      }
    });
  }

  async sendSessionReminder1h(user, userType, otherPersonName, sessionTitle, timeStr, meetingId) {
    const { user: userRecord, profileId } = await this.resolveUserAndProfile(user, userType);
    if (!userRecord || !userRecord.email) return;

    const joinUrl = `${process.env.FRONTEND_URL || 'https://wisdom-iconnect.vercel.app'}/call/${meetingId}`;
    await this.sendNotification({
      receiverId: profileId || userRecord.id,
      receiverType: userType,
      type: 'booking',
      title: 'Call Starts in 1 Hour!',
      message: `Your mentorship call with ${otherPersonName} starts in 1 hour (${timeStr}).`,
      link: `/call/${meetingId}`,
      emailData: {
        to: userRecord.email,
        html: templates.reminder1h(userRecord.firstName || userRecord.name || 'User', otherPersonName, sessionTitle, timeStr, joinUrl)
      }
    });
  }

  async sendSessionReminder10m(user, userType, otherPersonName, sessionTitle, timeStr, meetingId) {
    const { user: userRecord, profileId } = await this.resolveUserAndProfile(user, userType);
    if (!userRecord || !userRecord.email) return;

    const joinUrl = `${process.env.FRONTEND_URL || 'https://wisdom-iconnect.vercel.app'}/call/${meetingId}`;
    await this.sendNotification({
      receiverId: profileId || userRecord.id,
      receiverType: userType,
      type: 'booking',
      title: 'Urgent: Call Starts in 10 Minutes!',
      message: `Your mentorship call with ${otherPersonName} is starting in 10 minutes! Click to join.`,
      link: `/call/${meetingId}`,
      emailData: {
        to: userRecord.email,
        html: templates.reminder10m(userRecord.firstName || userRecord.name || 'User', otherPersonName, sessionTitle, timeStr, joinUrl)
      }
    });
  }

}

module.exports = new NotificationService();
