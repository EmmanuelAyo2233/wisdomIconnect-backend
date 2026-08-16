const createBaseTemplate = (title, preheader, content) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
        .wrapper { width: 100%; background-color: #f4f6f8; padding: 32px 16px; box-sizing: border-box; }
        .container { max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05); border: 1px solid #e5e7eb; }
        .header { background: linear-gradient(135deg, #b22222 0%, #8b0000 100%); padding: 32px 24px; text-align: center; }
        .header-logo { color: #ffffff; font-size: 26px; font-weight: 900; letter-spacing: -0.5px; text-decoration: none; display: inline-block; }
        .header-subtitle { color: rgba(255, 255, 255, 0.8); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 4px; }
        .content { padding: 36px 32px; color: #374151; font-size: 15px; line-height: 1.65; }
        .content h2 { color: #111827; font-size: 22px; font-weight: 800; margin: 0 0 16px 0; letter-spacing: -0.3px; }
        .content p { margin: 0 0 16px 0; color: #4b5563; }
        .badge { display: inline-block; padding: 4px 12px; background-color: rgba(178, 34, 34, 0.08); color: #b22222; border: 1px solid rgba(178, 34, 34, 0.2); border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px; }
        .badge-urgent { background-color: #fef2f2; color: #dc2626; border-color: #fecaca; }
        .badge-success { background-color: #ecfdf5; color: #059669; border-color: #a7f3d0; }
        .btn-container { text-align: center; margin: 28px 0 16px 0; }
        .btn { display: inline-block; padding: 14px 32px; background-color: #b22222; color: #ffffff !important; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 14px; box-shadow: 0 4px 12px rgba(178, 34, 34, 0.25); transition: all 0.2s ease; }
        .btn:hover { background-color: #8b0000; }
        .card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 20px 0; }
        .card-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #edf2f7; font-size: 14px; }
        .card-row:last-child { border-bottom: none; }
        .card-label { color: #64748b; font-weight: 600; }
        .card-value { color: #0f172a; font-weight: 700; text-align: right; }
        .otp-box { background: linear-gradient(135deg, #fef2f2 0%, #fff5f5 100%); border: 2px dashed #b22222; padding: 24px; text-align: center; border-radius: 16px; margin: 24px 0; }
        .otp-code { font-size: 38px; font-weight: 900; letter-spacing: 10px; color: #b22222; font-mono: inherit; }
        .footer { background-color: #f9fafb; padding: 24px 32px; text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #f3f4f6; }
        .footer p { margin: 4px 0; }
        .footer a { color: #b22222; text-decoration: none; font-weight: 600; }
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="container">
            <div class="header">
                <a href="${process.env.FRONTEND_URL || 'https://wisdom-iconnect.vercel.app'}" class="header-logo">Wisicom</a>
                <div class="header-subtitle">Connecting Wisdom & Ambition</div>
            </div>
            <div class="content">
                ${content}
            </div>
            <div class="footer">
                <p>&copy; ${new Date().getFullYear()} Wisicom. Connecting generations through mentorship.</p>
                <p>If you have any questions, reach out to our team at <a href="mailto:support@wisdomconnect.com">support@wisdomconnect.com</a></p>
            </div>
        </div>
    </div>
</body>
</html>
`;

module.exports = {

  // 1. Email Verification
  emailVerification: (name, otp) => createBaseTemplate(
    'Verify Your Wisicom Email',
    'Enter your verification code to complete your signup.',
    `<div class="badge">Security Code</div>
     <h2>Welcome to Wisicom, ${name}!</h2>
     <p>Thank you for creating an account with Wisicom. To complete your registration and secure your profile, please verify your email address using the verification code below:</p>
     
     <div class="otp-box">
        <div class="otp-code">${otp}</div>
     </div>

     <p style="font-size: 13px; color: #6b7280; text-align: center;">⏱️ This verification code is valid for <strong>15 minutes</strong>.</p>
     <p style="font-size: 13px; color: #9ca3af;">If you did not sign up for a Wisicom account, you can safely ignore this email.</p>`
  ),

  // 2. Forgot Password OTP
  forgotPassword: (name, otp) => createBaseTemplate(
    'Reset Your Password',
    'Use this authorization code to reset your account password.',
    `<div class="badge badge-urgent">Password Reset</div>
     <h2>Hello, ${name}</h2>
     <p>We received a request to reset the password for your Wisicom account. Use the secure authorization code below to establish a new password:</p>

     <div class="otp-box">
        <div class="otp-code">${otp}</div>
     </div>

     <p style="font-size: 13px; color: #6b7280; text-align: center;">⏱️ This security code will expire in <strong>15 minutes</strong>.</p>
     <p style="font-size: 13px; color: #9ca3af;">If you did not initiate this request, please change your password immediately or contact our support team to safeguard your account.</p>`
  ),

  // 3. Welcome Email
  welcomeEmail: (name) => createBaseTemplate(
    'Welcome to Wisicom',
    'Your mentorship journey begins now.',
    `<div class="badge badge-success">Welcome</div>
     <h2>Glad to have you with us, ${name}!</h2>
     <p>Your Wisicom account is now active and ready. You are part of a global community connecting ambitious learners with seasoned professionals.</p>
     <p>Whether you are seeking specialized guidance or ready to empower others with your expertise, your journey starts right here.</p>

     <div class="btn-container">
        <a href="${process.env.FRONTEND_URL || 'https://wisdom-iconnect.vercel.app'}/login" class="btn">Explore Your Dashboard</a>
     </div>`
  ),

  // 3a. Mentor Application Received Email
  mentorApplicationReceived: (name) => createBaseTemplate(
    'Mentor Application Received - Wisicom',
    'Thank you for your interest in becoming a mentor with Wisicom.',
    `<div class="badge" style="background-color: #eff6ff; color: #1d4ed8; border-color: #bfdbfe;">Application Under Review</div>
     <h2>Thank You for Your Interest, ${name}!</h2>
     <p>Thank you for your interest in becoming a mentor with Wisicom! We have successfully received your application, background details, and submitted credentials.</p>
     <p>Our team is currently reviewing your profile to ensure the highest quality mentorship experience for our community. We will review your request and send an update to you in the next 24 hours.</p>
     
     <div class="card">
        <div class="card-row">
           <span class="card-label">Application Status</span>
           <span class="card-value" style="color: #d97706;">Under Review ⏳</span>
        </div>
        <div class="card-row">
           <span class="card-label">Estimated Response Time</span>
           <span class="card-value">Within 24 Hours</span>
        </div>
     </div>

     <p style="font-size: 13px; color: #6b7280; text-align: center;">Once approved, your mentor profile will go live immediately so mentees can discover and book sessions with you.</p>`
  ),

  // 3b. Mentor Approved Email
  mentorApprovedEmail: (name) => createBaseTemplate(
    'Mentor Application Approved 🎉',
    'Congratulations! Your mentor application on Wisicom has been approved.',
    `<div class="badge badge-success">Application Approved</div>
     <h2>Congratulations, ${name}! 🎉</h2>
     <p>Great news! Your mentor application has been reviewed and <strong>approved</strong> by our team.</p>
     <p>Your profile is now live and searchable across Wisicom. You can now set up your calendar availability, create and publish playbooks, and start accepting session bookings from ambitious mentees worldwide.</p>

     <div class="btn-container">
        <a href="${process.env.FRONTEND_URL || 'https://wisdom-iconnect.vercel.app'}/mentor/dashboard" class="btn">Go to Mentor Dashboard</a>
     </div>`
  ),

  // 3c. Mentor Application Rejected (Converted to Mentee) Email
  mentorRejectedEmail: (name) => createBaseTemplate(
    'Update on Your Wisicom Mentor Application',
    'Important update regarding your mentor application and account status.',
    `<div class="badge" style="background-color: #fef2f2; color: #b91c1c; border-color: #fecaca;">Application Status</div>
     <h2>Hello, ${name}</h2>
     <p>Thank you for your interest in becoming a mentor with Wisicom and for taking the time to share your experience with us.</p>
     <p>After careful review of your application, we are unable to approve your mentor profile at this time.</p>
     <p><strong>Good news:</strong> You can continue exploring Wisicom as a <strong>Mentee</strong>! Your account has been automatically configured with mentee access so you can search top mentors, book 1-on-1 guidance sessions, and learn valuable skills across diverse industries.</p>

     <div class="btn-container">
        <a href="${process.env.FRONTEND_URL || 'https://wisdom-iconnect.vercel.app'}/mentee/dashboard" class="btn">Explore as a Mentee</a>
     </div>`
  ),

  // 4. Password Reset Link
  passwordReset: (name, resetUrl) => createBaseTemplate(
    'Reset Your Password',
    'Click the secure link to update your account password.',
    `<div class="badge badge-urgent">Security</div>
     <h2>Hello, ${name}</h2>
     <p>We received a request to reset your password. Click the button below to safely create a new password for your account:</p>

     <div class="btn-container">
        <a href="${resetUrl}" class="btn">Reset My Password</a>
     </div>

     <p style="font-size: 13px; color: #9ca3af;">If you did not request a password reset, no action is required — your account remains completely secure.</p>`
  ),

  // 5. Password Changed Confirmation
  passwordChanged: (name) => createBaseTemplate(
    'Password Updated',
    'Your Wisicom account password was successfully updated.',
    `<div class="badge badge-success">Security Update</div>
     <h2>Password Updated Successfully</h2>
     <p>Hello ${name},</p>
     <p>This is confirmation that the password for your Wisicom account was updated recently.</p>
     <p style="font-size: 13px; color: #dc2626;">If you did not make this change, please contact customer support immediately to secure your account.</p>`
  ),

  // 6. Message Request Sent
  messageRequest: (receiverName, senderName, messageUrl) => createBaseTemplate(
    'New Connection Request',
    `${senderName} wants to connect with you on Wisicom.`,
    `<div class="badge">New Connection</div>
     <h2>Hello, ${receiverName}</h2>
     <p><strong>${senderName}</strong> has sent you a connection request on Wisicom.</p>
     <p>Building meaningful relationships is at the core of mentorship. Review their profile and message request to respond.</p>

     <div class="btn-container">
        <a href="${messageUrl}" class="btn">View Connection Request</a>
     </div>`
  ),

  // 7. Message Request Accepted
  messageRequestAccepted: (senderName, receiverName, chatUrl) => createBaseTemplate(
    'Connection Request Accepted',
    `${receiverName} accepted your connection request!`,
    `<div class="badge badge-success">Connection Established</div>
     <h2>Great news, ${senderName}!</h2>
     <p><strong>${receiverName}</strong> has accepted your connection request. You can now exchange direct messages and collaborate together.</p>

     <div class="btn-container">
        <a href="${chatUrl}" class="btn">Start Conversation</a>
     </div>`
  ),

  // 8. Message Request Declined
  messageRequestDeclined: (senderName, receiverName) => createBaseTemplate(
    'Connection Request Update',
    'Update regarding your connection request on Wisicom.',
    `<div class="badge">Update</div>
     <h2>Hello, ${senderName}</h2>
     <p><strong>${receiverName}</strong> is currently unavailable to accept your connection request at this time.</p>
     <p>Don't be discouraged — there are many incredible mentors and learners eager to connect on Wisicom!</p>`
  ),

  // 9. Booking Request Confirmation (to Mentee)
  bookingRequestConfirmation: (menteeName, mentorName, sessionTitle, dateTime, bookingsUrl) => createBaseTemplate(
    'Booking Request Submitted',
    `Your mentorship session request with ${mentorName} has been sent.`,
    `<div class="badge badge-success">Request Sent</div>
     <h2>Booking Request Submitted, ${menteeName}!</h2>
     <p>Your mentorship session request has been submitted to <strong>${mentorName}</strong>.</p>

     <div class="card">
        <div class="card-row">
            <span class="card-label">Mentor:</span>
            <span class="card-value">${mentorName}</span>
        </div>
        <div class="card-row">
            <span class="card-label">Session Topic:</span>
            <span class="card-value">${sessionTitle || 'Mentorship Session'}</span>
        </div>
        <div class="card-row">
            <span class="card-label">Date & Time:</span>
            <span class="card-value">${dateTime}</span>
        </div>
     </div>

     <p>We will notify you as soon as ${mentorName} responds to your booking request.</p>

     <div class="btn-container">
        <a href="${bookingsUrl}" class="btn">View My Bookings</a>
     </div>`
  ),

  // 10. Booking Request Sent (to Mentor)
  bookingRequestSent: (mentorName, menteeName, sessionTitle, dateTime, dashboardUrl, goals) => createBaseTemplate(
    'New Booking Request Received',
    `${menteeName} has requested a mentorship session with you.`,
    `<div class="badge">New Session Request</div>
     <h2>Hello, ${mentorName}</h2>
     <p><strong>${menteeName}</strong> has requested a mentorship session with you on Wisicom.</p>

     <div class="card">
        <div class="card-row">
            <span class="card-label">Mentee:</span>
            <span class="card-value">${menteeName}</span>
        </div>
        <div class="card-row">
            <span class="card-label">Topic / Session:</span>
            <span class="card-value">${sessionTitle || 'Mentorship Session'}</span>
        </div>
        ${goals ? `
        <div class="card-row" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e2e8f0; flex-direction: column; align-items: flex-start; text-align: left;">
            <span class="card-label" style="display: block; margin-bottom: 6px; font-weight: bold; color: #1e293b;">Specific Objectives / Mentee Goals:</span>
            <span class="card-value" style="display: block; text-align: left; background: #f8fafc; padding: 12px; border-radius: 8px; color: #334155; border-left: 4px solid #b22222; font-size: 13px; line-height: 1.5; width: 100%;">"${goals}"</span>
        </div>` : ''}
        <div class="card-row" style="margin-top: 10px;">
            <span class="card-label">Date & Time:</span>
            <span class="card-value">${dateTime}</span>
        </div>
     </div>

     <p>Please review and respond to this request from your dashboard to confirm your availability.</p>

     <div class="btn-container">
        <a href="${dashboardUrl}" class="btn">Review Request</a>
     </div>`
  ),

  // 10. Booking Accepted (to Mentee)
  bookingAccepted: (menteeName, mentorName, sessionTitle, dateTime, joinUrl, goals) => createBaseTemplate(
    'Session Confirmed!',
    `Your session with ${mentorName} is confirmed.`,
    `<div class="badge badge-success">Booking Confirmed</div>
     <h2>Your session is set, ${menteeName}!</h2>
     <p>Great news — <strong>${mentorName}</strong> has accepted your booking request. Here are your session details:</p>

     <div class="card">
        <div class="card-row">
            <span class="card-label">Mentor:</span>
            <span class="card-value">${mentorName}</span>
        </div>
        <div class="card-row">
            <span class="card-label">Session Topic:</span>
            <span class="card-value">${sessionTitle || 'Mentorship Session'}</span>
        </div>
        ${goals ? `
        <div class="card-row" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e2e8f0; flex-direction: column; align-items: flex-start; text-align: left;">
            <span class="card-label" style="display: block; margin-bottom: 6px; font-weight: bold; color: #1e293b;">Specific Objectives:</span>
            <span class="card-value" style="display: block; text-align: left; background: #f8fafc; padding: 12px; border-radius: 8px; color: #334155; border-left: 4px solid #10b981; font-size: 13px; line-height: 1.5; width: 100%;">"${goals}"</span>
        </div>` : ''}
        <div class="card-row" style="margin-top: 10px;">
            <span class="card-label">Date & Time:</span>
            <span class="card-value">${dateTime}</span>
        </div>
     </div>

     <div class="btn-container">
        <a href="${joinUrl}" class="btn">View Session Details</a>
     </div>`
  ),

  // 11. Booking Declined (to Mentee)
  bookingDeclined: (menteeName, mentorName, reason) => createBaseTemplate(
    'Session Booking Update',
    `Update regarding your booking request with ${mentorName}.`,
    `<div class="badge">Booking Update</div>
     <h2>Hello, ${menteeName}</h2>
     <p><strong>${mentorName}</strong> is unable to accept your booking request for this time slot.</p>
     ${reason ? `<div class="card"><p class="card-label">Mentor Note:</p><p class="card-value" style="text-align: left; margin-top: 4px;">"${reason}"</p></div>` : ''}
     <p>If you made a payment for this session, your funds will be fully refunded to your wallet balance automatically.</p>`
  ),

  // 12. Booking Cancelled
  bookingCancelled: (recipientName, otherPersonName, reason) => createBaseTemplate(
    'Session Cancelled',
    `Notice: Upcoming session with ${otherPersonName} has been cancelled.`,
    `<div class="badge badge-urgent">Session Cancelled</div>
     <h2>Hello, ${recipientName}</h2>
     <p>Your upcoming mentorship session with <strong>${otherPersonName}</strong> has been cancelled.</p>
     ${reason ? `<div class="card"><p class="card-label">Reason:</p><p class="card-value" style="text-align: left; margin-top: 4px;">"${reason}"</p></div>` : ''}
     <p>You can browse open availability slots anytime to reschedule your session.</p>`
  ),

  // 13. Call Reminder — 1 Day Before (24 Hours)
  reminder24h: (name, otherName, sessionTitle, dateStr, timeStr, joinUrl) => createBaseTemplate(
    'Upcoming Call Tomorrow',
    `Reminder: Your mentorship session with ${otherName} is scheduled for tomorrow.`,
    `<div class="badge">Upcoming Session</div>
     <h2>See you tomorrow, ${name}!</h2>
     <p>This is a reminder that your mentorship session with <strong>${otherName}</strong> is scheduled for tomorrow.</p>

     <div class="card">
        <div class="card-row">
            <span class="card-label">Participant:</span>
            <span class="card-value">${otherName}</span>
        </div>
        <div class="card-row">
            <span class="card-label">Session Topic:</span>
            <span class="card-value">${sessionTitle || 'Mentorship Session'}</span>
        </div>
        <div class="card-row">
            <span class="card-label">Date:</span>
            <span class="card-value">${dateStr}</span>
        </div>
        <div class="card-row">
            <span class="card-label">Time:</span>
            <span class="card-value">${timeStr}</span>
        </div>
     </div>

     <p>Please make sure your microphone, camera, and internet connection are ready before the call.</p>

     <div class="btn-container">
        <a href="${joinUrl}" class="btn">View Session Details</a>
     </div>`
  ),

  // 14. Call Reminder — 1 Hour Before
  reminder1h: (name, otherName, sessionTitle, timeStr, joinUrl) => createBaseTemplate(
    'Call Starts in 1 Hour!',
    `Your session with ${otherName} starts in 1 hour.`,
    `<div class="badge badge-urgent">Starts in 1 Hour</div>
     <h2>Your session is starting soon, ${name}!</h2>
     <p>Your mentorship call with <strong>${otherName}</strong> starts in <strong>1 hour</strong> (${timeStr}).</p>

     <div class="card">
        <div class="card-row">
            <span class="card-label">With:</span>
            <span class="card-value">${otherName}</span>
        </div>
        <div class="card-row">
            <span class="card-label">Topic:</span>
            <span class="card-value">${sessionTitle || 'Mentorship Session'}</span>
        </div>
        <div class="card-row">
            <span class="card-label">Start Time:</span>
            <span class="card-value">${timeStr}</span>
        </div>
     </div>

     <div class="btn-container">
        <a href="${joinUrl}" class="btn">Prepare to Join</a>
     </div>`
  ),

  // 15. Call Reminder — 10 Minutes Before (Urgent)
  reminder10m: (name, otherName, sessionTitle, timeStr, joinUrl) => createBaseTemplate(
    'Urgent: Call Starts in 10 Minutes!',
    `Your call with ${otherName} begins in 10 minutes. Click to join.`,
    `<div class="badge badge-urgent">Starting in 10 Minutes</div>
     <h2>Get ready! Call starts in 10 minutes</h2>
     <p>Hello ${name}, your mentorship session with <strong>${otherName}</strong> is starting in just <strong>10 minutes</strong>!</p>

     <div class="card" style="border-left: 4px solid #b22222;">
        <div class="card-row">
            <span class="card-label">Call With:</span>
            <span class="card-value">${otherName}</span>
        </div>
        <div class="card-row">
            <span class="card-label">Scheduled Time:</span>
            <span class="card-value">${timeStr}</span>
        </div>
     </div>

     <div class="btn-container">
        <a href="${joinUrl}" class="btn" style="font-size: 16px; padding: 16px 36px;">Join Call Now</a>
     </div>`
  ),

  // 16. Payment Success
  paymentSuccess: (name, amount, purpose, receiptUrl) => createBaseTemplate(
    'Payment Confirmation',
    `Your payment of ${amount} has been processed successfully.`,
    `<div class="badge badge-success">Payment Received</div>
     <h2>Payment Receipt</h2>
     <p>Hello ${name}, thank you for your payment. Your transaction was completed successfully.</p>

     <div class="card">
        <div class="card-row">
            <span class="card-label">Amount Paid:</span>
            <span class="card-value">${amount}</span>
        </div>
        <div class="card-row">
            <span class="card-label">Description:</span>
            <span class="card-value">${purpose}</span>
        </div>
        <div class="card-row">
            <span class="card-label">Date:</span>
            <span class="card-value">${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        </div>
     </div>

     ${receiptUrl ? `<div class="btn-container"><a href="${receiptUrl}" class="btn">View Full Receipt</a></div>` : ''}`
  ),

  // 17. Refund Initiated
  refundInitiated: (name, amount, purpose) => createBaseTemplate(
    'Refund Processed',
    `Your refund of ${amount} has been credited to your wallet balance.`,
    `<div class="badge badge-success">Refund Completed</div>
     <h2>Hello, ${name}</h2>
     <p>A refund of <strong>${amount}</strong> for <em>"${purpose}"</em> has been credited directly to your Wisicom wallet balance.</p>
     <p>You can use this balance for future session bookings or withdraw it to your bank account anytime.</p>`
  ),


  // 18. Withdrawal Requested (mentor initiates withdrawal — pending admin review)
  withdrawalRequested: (name, amount) => createBaseTemplate(
    'Withdrawal Request Received',
    `Your withdrawal request of ${amount} has been received and is being processed.`,
    `<div class="badge">Withdrawal Request</div>
     <h2>Withdrawal Request Received</h2>
     <p>Hello ${name}, your withdrawal request of <strong>${amount}</strong> has been received successfully.</p>

     <div class="card">
        <div class="card-row">
            <span class="card-label">Amount Requested:</span>
            <span class="card-value">${amount}</span>
        </div>
        <div class="card-row">
            <span class="card-label">Status:</span>
            <span class="card-value" style="color: #d97706;">Pending Processing</span>
        </div>
     </div>

     <p>Our team will process your withdrawal and transfer the funds to your registered bank account. This typically takes <strong>1–3 business days</strong>.</p>
     <p style="font-size: 13px; color: #9ca3af;">You will receive a confirmation email once the funds have been transferred.</p>`
  ),

  // 19. Payout Approved (admin actually processes the bank transfer)
  payoutProcessed: (name, amount) => createBaseTemplate(
    'Payout Successfully Transferred',
    `Your payout of ${amount} has been sent to your bank account.`,
    `<div class="badge badge-success">Payout Completed</div>
     <h2>Your payout is on its way!</h2>
     <p>Hello ${name}, great news! Your withdrawal of <strong>${amount}</strong> has been approved and the funds have been transferred to your registered bank account.</p>

     <div class="card">
        <div class="card-row">
            <span class="card-label">Amount Transferred:</span>
            <span class="card-value">${amount}</span>
        </div>
        <div class="card-row">
            <span class="card-label">Status:</span>
            <span class="card-value" style="color: #059669;">Transfer Initiated</span>
        </div>
     </div>

     <p>Please allow <strong>1–2 business days</strong> for the funds to reflect in your account, depending on your bank's processing times.</p>
     <p style="font-size: 13px; color: #9ca3af;">If you have any concerns, contact our support team at support@wisdomconnect.com</p>`
  )
};

