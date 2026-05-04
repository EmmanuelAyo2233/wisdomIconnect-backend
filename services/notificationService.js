const Notification = require('../models/notification');
const emailService = require('./emailService');
const templates = require('../utils/emailTemplates');

/**
 * Core Notification Service to handle sending both in-app and email notifications.
 */
class NotificationService {

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

      // 2. Send Email if emailData is provided
      if (emailData && emailData.to) {
        await emailService.sendEmail({
          to: emailData.to,
          subject: title || 'New Notification from WisdomIconnect',
          html: emailData.html
        });
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
    await emailService.sendEmail({
      to: user.email,
      subject: 'Verify your email address',
      html: templates.emailVerification(user.firstName || user.name, otp)
    });
  }

  async sendWelcomeNotification(user, userType) {
    let receiverId = user.id; // fallback
    if (userType === 'mentor' && user.mentor) receiverId = user.mentor.id;
    if (userType === 'mentee' && user.mentee) receiverId = user.mentee.id;

    await this.sendNotification({
      receiverId: receiverId,
      receiverType: userType,
      type: 'auth',
      title: 'Welcome to WisdomIconnect!',
      message: 'Your account has been successfully created. Explore the platform and connect with others!',
      emailData: {
        to: user.email,
        html: templates.welcomeEmail(user.firstName || user.name)
      }
    });
  }

  async sendPasswordReset(user, token) {
    const url = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    await emailService.sendEmail({
      to: user.email,
      subject: 'Reset your password',
      html: templates.passwordReset(user.firstName || user.name, url)
    });
  }

  // ==========================================
  // MESSAGING EVENTS
  // ==========================================

  async sendMessageRequest(sender, receiver, receiverType) {
    const messageUrl = `${process.env.FRONTEND_URL}/${receiverType}/messages`;
    const Mentor = require('../models/mentor');
    const Mentee = require('../models/mentee');
    
    let rId = receiver.id;
    let sId = sender.id;
    
    if (receiverType === 'mentor') {
       const m = await Mentor.findOne({ where: { user_id: receiver.id }});
       if (m) rId = m.id;
       const me = await Mentee.findOne({ where: { user_id: sender.id }});
       if (me) sId = me.id;
    } else {
       const me = await Mentee.findOne({ where: { user_id: receiver.id }});
       if (me) rId = me.id;
       const m = await Mentor.findOne({ where: { user_id: sender.id }});
       if (m) sId = m.id;
    }

    await this.sendNotification({
      receiverId: rId,
      receiverType,
      senderId: sId,
      type: 'message_request',
      title: 'New Message Request',
      message: `You have a new message request from ${sender.firstName || sender.name}.`,
      link: `/${receiverType}/messages`,
      emailData: {
        to: receiver.email,
        html: templates.messageRequest(receiver.firstName || receiver.name, sender.firstName || sender.name, messageUrl)
      }
    });
  }

  async sendMessageRequestAccepted(sender, receiver, senderType) {
    const chatUrl = `${process.env.FRONTEND_URL}/${senderType}/messages`;
    const Mentor = require('../models/mentor');
    const Mentee = require('../models/mentee');
    
    let rId = sender.id; // Sender of original request becomes receiver of acceptance
    let sId = receiver.id;
    
    if (senderType === 'mentor') {
       const m = await Mentor.findOne({ where: { user_id: sender.id }});
       if (m) rId = m.id;
       const me = await Mentee.findOne({ where: { user_id: receiver.id }});
       if (me) sId = me.id;
    } else {
       const me = await Mentee.findOne({ where: { user_id: sender.id }});
       if (me) rId = me.id;
       const m = await Mentor.findOne({ where: { user_id: receiver.id }});
       if (m) sId = m.id;
    }

    await this.sendNotification({
      receiverId: rId,
      receiverType: senderType,
      senderId: sId,
      type: 'message_request_response',
      title: 'Message Request Accepted',
      message: `${receiver.firstName || receiver.name} has accepted your message request.`,
      link: `/${senderType}/messages`,
      emailData: {
        to: sender.email,
        html: templates.messageRequestAccepted(sender.firstName || sender.name, receiver.firstName || receiver.name, chatUrl)
      }
    });
  }

  // ==========================================
  // BOOKING EVENTS
  // ==========================================

  async sendBookingRequest(mentee, mentor, sessionDetails) {
    const dashboardUrl = `${process.env.FRONTEND_URL}/mentor/dashboard`;
    const Mentor = require('../models/mentor');
    const Mentee = require('../models/mentee');
    
    let rId = mentor.id;
    let sId = mentee.id;
    const m = await Mentor.findOne({ where: { user_id: mentor.id }});
    if (m) rId = m.id;
    const me = await Mentee.findOne({ where: { user_id: mentee.id }});
    if (me) sId = me.id;

    await this.sendNotification({
      receiverId: rId,
      receiverType: 'mentor',
      senderId: sId,
      type: 'booking',
      title: 'New Booking Request',
      message: `${mentee.firstName || mentee.name} has requested a session with you.`,
      link: '/mentor/bookings',
      emailData: {
        to: mentor.email,
        html: templates.bookingRequestSent(mentor.firstName || mentor.name, mentee.firstName || mentee.name, sessionDetails, dashboardUrl)
      }
    });
  }

  async sendBookingAccepted(mentee, mentor, sessionDetails, meetingLink) {
    const joinUrl = `${process.env.FRONTEND_URL}${meetingLink || '/mentee/sessions'}`;
    const Mentor = require('../models/mentor');
    const Mentee = require('../models/mentee');
    
    let rId = mentee.id;
    let sId = mentor.id;
    const me = await Mentee.findOne({ where: { user_id: mentee.id }});
    if (me) rId = me.id;
    const m = await Mentor.findOne({ where: { user_id: mentor.id }});
    if (m) sId = m.id;

    await this.sendNotification({
      receiverId: rId,
      receiverType: 'mentee',
      senderId: sId,
      type: 'booking',
      title: 'Booking Accepted',
      message: `${mentor.firstName || mentor.name} has accepted your session request.`,
      link: '/mentee/bookings',
      emailData: {
        to: mentee.email,
        html: templates.bookingAccepted(mentee.firstName || mentee.name, mentor.firstName || mentor.name, sessionDetails, joinUrl)
      }
    });
  }

  // ==========================================
  // PAYMENT & TRANSACTION EVENTS
  // ==========================================

  async sendPaymentSuccess(user, userType, amount, purpose) {
    await this.sendNotification({
      receiverId: user.id,
      receiverType: userType,
      type: 'payment',
      title: 'Payment Successful',
      message: `Your payment of ${amount} for ${purpose} was successful.`,
      emailData: {
        to: user.email,
        html: templates.paymentSuccess(user.firstName || user.name, amount, purpose)
      }
    });
  }

  async sendPayoutProcessed(mentor, amount) {
    await this.sendNotification({
      receiverId: mentor.id,
      receiverType: 'mentor',
      type: 'payment',
      title: 'Payout Processed',
      message: `A payout of ${amount} has been processed to your account.`,
      emailData: {
        to: mentor.email,
        html: templates.payoutProcessed(mentor.firstName || mentor.name, amount)
      }
    });
  }

}

module.exports = new NotificationService();
