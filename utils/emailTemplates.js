const createBaseTemplate = (title, content) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 0; }
        .container { max-w: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); }
        .header { background-color: #1e3a8a; padding: 24px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; }
        .content { padding: 32px; color: #374151; line-height: 1.6; }
        .content h2 { color: #111827; font-size: 20px; margin-top: 0; }
        .btn { display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 20px; }
        .footer { background-color: #f9fafb; padding: 24px; text-align: center; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; }
        .details-box { background-color: #f3f4f6; border-radius: 6px; padding: 16px; margin: 20px 0; }
        .details-box p { margin: 8px 0; }
        .strong { font-weight: 600; color: #111827; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>WisdomIconnect</h1>
        </div>
        <div class="content">
            ${content}
        </div>
        <div class="footer">
            <p>Empowering individuals through expert mentorship.</p>
            <p>&copy; ${new Date().getFullYear()} WisdomIconnect. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
`;

module.exports = {
  // Auth
  emailVerification: (name, otp) => createBaseTemplate(
    'Verify your email',
    `<h2>Welcome, ${name}!</h2>
     <p>We're thrilled to have you join WisdomIconnect. To get started, please verify your email address by entering the following 6-digit code:</p>
     <div style="background-color: #f3f4f6; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; border-radius: 8px; margin: 20px 0;">
        ${otp}
     </div>
     <p>This code will expire in 15 minutes. If you did not request this, please ignore this email.</p>`
  ),

  forgotPassword: (name, otp) => createBaseTemplate(
    'Reset your password',
    `<h2>Password Reset Request</h2>
     <p>Hi ${name},</p>
     <p>We received a request to reset your WisdomIconnect password. Enter the 6-digit code below to create a new password:</p>
     <div style="background-color: #fef3f2; border: 2px solid #b22222; padding: 20px; text-align: center; font-size: 36px; font-weight: bold; letter-spacing: 8px; border-radius: 12px; margin: 24px 0; color: #b22222;">
        ${otp}
     </div>
     <p style="color: #6b7280; font-size: 14px;">⏱️ This code expires in <strong>15 minutes</strong>.</p>
     <p style="color: #6b7280; font-size: 14px;">If you did not request a password reset, please ignore this email — your account is safe.</p>`
  ),

  welcomeEmail: (name) => createBaseTemplate(
    'Welcome to WisdomIconnect',
    `<h2>Welcome to the community, ${name}!</h2>
     <p>Your account is fully set up. You can now start exploring world-class mentors or begin sharing your wisdom with others.</p>
     <a href="${process.env.FRONTEND_URL}/login" class="btn" style="color: #ffffff;">Sign In to Dashboard</a>`
  ),

  passwordReset: (name, resetUrl) => createBaseTemplate(
    'Reset your password',
    `<h2>Hello, ${name}</h2>
     <p>We received a request to reset your password. If you didn't make this request, you can safely ignore this email.</p>
     <p>To reset your password, click the button below:</p>
     <a href="${resetUrl}" class="btn" style="color: #ffffff;">Reset Password</a>`
  ),

  passwordChanged: (name) => createBaseTemplate(
    'Password Changed Successfully',
    `<h2>Hello, ${name}</h2>
     <p>Your password has been successfully changed.</p>
     <p>If you did not perform this action, please contact support immediately to secure your account.</p>`
  ),

  // Messaging
  messageRequest: (receiverName, senderName, messageUrl) => createBaseTemplate(
    'New Message Request',
    `<h2>Hello, ${receiverName}</h2>
     <p><span class="strong">${senderName}</span> has sent you a new message request on WisdomIconnect.</p>
     <a href="${messageUrl}" class="btn" style="color: #ffffff;">View Request</a>`
  ),

  messageRequestAccepted: (senderName, receiverName, chatUrl) => createBaseTemplate(
    'Message Request Accepted',
    `<h2>Hello, ${senderName}</h2>
     <p>Great news! <span class="strong">${receiverName}</span> has accepted your message request.</p>
     <p>You can now chat with them directly.</p>
     <a href="${chatUrl}" class="btn" style="color: #ffffff;">Go to Messages</a>`
  ),

  messageRequestDeclined: (senderName, receiverName) => createBaseTemplate(
    'Message Request Declined',
    `<h2>Hello, ${senderName}</h2>
     <p>Unfortunately, <span class="strong">${receiverName}</span> has declined your message request at this time.</p>
     <p>Don't worry, there are plenty of other experts and learners on the platform!</p>`
  ),

  // Booking
  bookingRequestSent: (mentorName, menteeName, sessionDetails, dashboardUrl) => createBaseTemplate(
    'New Booking Request',
    `<h2>Hello, ${mentorName}</h2>
     <p><span class="strong">${menteeName}</span> has requested a new mentorship session with you.</p>
     <div class="details-box">
        ${sessionDetails}
     </div>
     <a href="${dashboardUrl}" class="btn" style="color: #ffffff;">Review Booking</a>`
  ),

  bookingAccepted: (menteeName, mentorName, sessionDetails, joinUrl) => createBaseTemplate(
    'Booking Accepted',
    `<h2>Hello, ${menteeName}</h2>
     <p>Great news! <span class="strong">${mentorName}</span> has accepted your booking request.</p>
     <div class="details-box">
        ${sessionDetails}
     </div>
     <a href="${joinUrl}" class="btn" style="color: #ffffff;">View Session Details</a>`
  ),

  bookingDeclined: (menteeName, mentorName, reason) => createBaseTemplate(
    'Booking Declined',
    `<h2>Hello, ${menteeName}</h2>
     <p>Unfortunately, <span class="strong">${mentorName}</span> is unable to accept your booking request right now.</p>
     ${reason ? `<p><span class="strong">Reason:</span> ${reason}</p>` : ''}
     <p>Your payment (if any) will be fully refunded.</p>`
  ),

  bookingCancelled: (mentorName, menteeName, reason) => createBaseTemplate(
    'Booking Cancelled',
    `<h2>Hello, ${mentorName}</h2>
     <p><span class="strong">${menteeName}</span> has cancelled your upcoming session.</p>
     ${reason ? `<p><span class="strong">Reason:</span> ${reason}</p>` : ''}`
  ),

  sessionReminder: (name, mentorOrMenteeName, timeString, joinUrl) => createBaseTemplate(
    'Session Reminder',
    `<h2>Hello, ${name}</h2>
     <p>This is a reminder for your upcoming session with <span class="strong">${mentorOrMenteeName}</span>.</p>
     <div class="details-box">
        <p><span class="strong">Time:</span> ${timeString}</p>
     </div>
     <a href="${joinUrl}" class="btn" style="color: #ffffff;">Join Session</a>`
  ),

  // Payments
  paymentSuccess: (name, amount, purpose, receiptUrl) => createBaseTemplate(
    'Payment Successful',
    `<h2>Hello, ${name}</h2>
     <p>Your payment of <span class="strong">${amount}</span> was successful.</p>
     <div class="details-box">
        <p><span class="strong">Purpose:</span> ${purpose}</p>
        <p><span class="strong">Date:</span> ${new Date().toLocaleDateString()}</p>
     </div>
     ${receiptUrl ? `<a href="${receiptUrl}" class="btn" style="color: #ffffff;">View Receipt</a>` : ''}`
  ),

  paymentFailed: (name, amount, purpose, retryUrl) => createBaseTemplate(
    'Payment Failed',
    `<h2>Hello, ${name}</h2>
     <p>Unfortunately, your payment of <span class="strong">${amount}</span> for ${purpose} failed to process.</p>
     <p>Please try again or use a different payment method.</p>
     ${retryUrl ? `<a href="${retryUrl}" class="btn" style="color: #ffffff;">Retry Payment</a>` : ''}`
  ),

  refundInitiated: (name, amount, purpose) => createBaseTemplate(
    'Refund Initiated',
    `<h2>Hello, ${name}</h2>
     <p>We have initiated a refund of <span class="strong">${amount}</span> for ${purpose}.</p>
     <p>It may take a few business days for the funds to appear in your account.</p>`
  ),

  payoutProcessed: (name, amount) => createBaseTemplate(
    'Payout Processed',
    `<h2>Hello, ${name}</h2>
     <p>Great news! A payout of <span class="strong">${amount}</span> has been processed to your bank account.</p>
     <p>Please allow standard bank processing times for the funds to reflect.</p>`
  ),
};
