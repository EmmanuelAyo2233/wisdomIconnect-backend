  const { User, Mentee, Mentor } = require("../models");
  const { logActivity } = require("../services/activityLogger");
  const {
    bcrypt,
    EMAIL_REGEX,
    salt,
    SECRET_KEY,
    jwt,
    Op,
  } = require("../config/reuseablePackages");
  const notificationService = require("../services/notificationService");
  const emailService = require("../services/emailService");
  const crypto = require("crypto");

  // ------- helpers -------
  const wordCount = (text = "") =>
    String(text).trim().split(/\s+/).filter(Boolean).length;

  const asArray = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === "string") {
      // try JSON first, then comma split
      try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed : [val];
      } catch {
        return val.split(",").map((s) => s.trim()).filter(Boolean);
      }
    }
    return [val];
  };

  // Handles new user registration
  const signup = async (req, res) => {
    try {
      const b = req.body;

      // Required
      if (!b.name || !b.email || !b.userType || !b.password || !b.confirmPassword) {
        return res.status(400).json({ status: "fail", message: "All required fields must be filled" });
      }

      // Email + password checks
      if (!EMAIL_REGEX.test(b.email)) {
        return res.status(400).json({ status: "fail", message: "Invalid email address" });
      }
      if (b.password !== b.confirmPassword) {
        return res.status(400).json({ status: "fail", message: "Passwords do not match" });
      }
      if (String(b.password).length < 8) {
        return res.status(400).json({ status: "fail", message: "Password must be at least 8 characters" });
      }

      // Role
      if (!["mentor", "mentee"].includes(b.userType)) {
        return res.status(400).json({ status: "fail", message: "Invalid user type" });
      }

      // Uniqueness
      const existingUser = await User.findOne({ where: { email: b.email } });
      if (existingUser) {
        return res.status(400).json({ status: "fail", message: "User already exists" });
      }

      // Normalized fields
      const shortBio = b.shortBio || b.bio || null; // accept either key
      if (shortBio && wordCount(shortBio) > 200) {
        return res.status(400).json({ status: "fail", message: "Short bio must be at most 200 words" });
      }

      const hashedPassword = await bcrypt.hash(b.password, salt);

      if (b.userType === "mentor") {
        // Mentor-specific validation
        const expertise = asArray(b.expertise || b.topics); // max 5
        const disciplines = asArray(b.disciplines); // max 3
        const industries = asArray(b.industries); // max 3
        const fluentIn = asArray(b.fluentIn); // max 5

        if (!b.yearsOfExperience) {
          return res.status(400).json({ status: "fail", message: "Years of experience is required" });
        }
        if (!expertise.length) {
          return res.status(400).json({ status: "fail", message: "Select at least 1 expertise topic" });
        }
        if (expertise.length > 5) {
          return res.status(400).json({ status: "fail", message: "Select up to 5 expertise topics" });
        }
        if (disciplines.length > 3) {
          return res.status(400).json({ status: "fail", message: "Select up to 3 disciplines" });
        }
        if (industries.length > 3) {
          return res.status(400).json({ status: "fail", message: "Select up to 3 industries" });
        }
        if (fluentIn.length > 5) {
          return res.status(400).json({ status: "fail", message: "Select up to 5 fluent languages" });
        }

        // Handle file upload if present
        let certUrl = null;
        if (req.file) {
          certUrl = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              { folder: "wisdom_connect_credentials" },
              (err, result) => {
                if (err) reject(err);
                else resolve(result.secure_url);
              }
            );
            streamFier.createReadStream(req.file.buffer).pipe(stream);
          });
        }

        // Create user with pending status (mentor verification)
        const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();
        const newUser = await User.create({
          name: b.name,
          email: b.email,
          password: hashedPassword,
          userType: "mentor",
          status: "pending", // pending approval
          verificationToken,
          isVerified: false,
        });

        const shortBio = b.shortBio || b.bio || null;

        if (certUrl) {
            expertise.push(`CERTIFICATE_URL_${certUrl}`);
        }

        const mentor = await Mentor.create({
          user_id: newUser.id,
          yearsOfExperience: b.yearsOfExperience || b.experience || 0,
          bio: shortBio,   // ✅ correct column
          expertise: JSON.stringify(expertise),
          discipline: JSON.stringify(disciplines),
          industries: JSON.stringify(industries),
          fluentIn: JSON.stringify(fluentIn),
          linkedinUrl: b.linkedinUrl || null,
        });

      const userResponse = newUser.get({ plain: true });
      delete userResponse.password;

      // Send Verification Email
      notificationService.sendEmailVerification(userResponse, verificationToken).catch(err => console.error("Notification Error:", err));

      logActivity({
        type: "USER",
        message: `Mentor registration submitted: ${b.name} (${b.email})`,
        userId: newUser.id,
        status: "success"
      });

      return res.status(201).json({
        status: "success",
        requiresVerification: true,
        email: b.email,
        message: "Mentor registration submitted. Please verify your email.",
        banner: "Your account is under review. You’ll be available in search & bookings once approved.",
        data: { user: userResponse, mentor },
      });

    } else if (b.userType === "mentee") {
      // Mentee flow
      let rawInterests = b.interests;
      // if interests look like "Guidance in Web Development", map them to base equivalent optionally, but user says "Remove it when storing/matching in backend". Let's handle string stripping.
      const rawInterestsArray = asArray(rawInterests);
      const interests = rawInterestsArray.map(i => i.replace(/^Guidance in\s+/i, ''));

      if (!interests.length) {
        return res.status(400).json({ status: "fail", message: "Select at least 1 interest" });
      }
      if (interests.length > 5) {
        return res.status(400).json({ status: "fail", message: "Select up to 5 interests" });
      }

      const expertise = asArray(b.expertise);
      const disciplines = asArray(b.disciplines);
      const industries = asArray(b.industries);
      const fluentIn = asArray(b.fluentIn);

      if (expertise.length > 5) return res.status(400).json({ status: "fail", message: "Select up to 5 expertise topics" });
      if (disciplines.length > 3) return res.status(400).json({ status: "fail", message: "Select up to 3 disciplines" });
      if (industries.length > 3) return res.status(400).json({ status: "fail", message: "Select up to 3 industries" });
      if (fluentIn.length > 5) return res.status(400).json({ status: "fail", message: "Select up to 5 fluent languages" });

      const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();
      const newUser = await User.create({
        name: b.name,
        email: b.email,
        password: hashedPassword,
        userType: "mentee",
        status: "approved", // mentees auto-approved
        verificationToken,
        isVerified: false,
      });

      const mentee = await Mentee.create({
          user_id: newUser.id,
          bio: shortBio,
          interest: JSON.stringify(interests),
          expertise: JSON.stringify(expertise),
          discipline: JSON.stringify(disciplines),
          industries: JSON.stringify(industries),
          fluentIn: JSON.stringify(fluentIn),
      });


      const userResponse = newUser.get({ plain: true });
      delete userResponse.password;

      // Send Verification Email
      notificationService.sendEmailVerification(userResponse, verificationToken).catch(err => console.error("Notification Error:", err));

      logActivity({
        type: "USER",
        message: `Mentee registration successful: ${b.name} (${b.email})`,
        userId: newUser.id,
        status: "success"
      });

      return res.status(201).json({
        status: "success",
        requiresVerification: true,
        email: b.email,
        message: "Mentee registration successful. Please verify your email.",
        data: { user: userResponse, mentee },
      });
    }
  } catch (error) {
    console.log("Signup error:", error);
    res.status(500).json({
      message: "Failed to register user",
      error: error.message,
    });
  }
};
  // Handles user login
  const login = async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ status: "fail", message: "Email and password are required" });
      }
      if (!EMAIL_REGEX.test(email)) {
        return res.status(400).json({ status: "fail", message: "Invalid email address" });
      }

      const user = await User.findOne({ where: { email } });
      if (!user) {
        return res.status(404).json({ status: "fail", message: "User not found" });
      }

      const ok = await bcrypt.compare(password, user.password);
      if (!ok) {
        return res.status(400).json({ status: "fail", message: "Password incorrect" });
      }
if (user.userType === "mentor") {
  await Mentor.update(
    { isOnline: true },
    { where: { user_id: user.id } }   // match DB column exactly
  );

  const mentorCheck = await Mentor.findOne({ where: { user_id: user.id } });
  console.log("Mentor isOnline from backend:", mentorCheck?.isOnline);
}


      // NOTE: Pending mentors CAN log in (dashboard access), but won’t appear in search/booking.
      // We'll surface a banner hint via response.
      const tokenPayload = {
        id: user.id,
        email: user.email,
        userType: user.userType,  // ✅ keep the same field as DB + restrictTo
        status: user.status
      };

      const token = jwt.sign(tokenPayload, SECRET_KEY, { expiresIn: "7d" });
      console.log("Token issued:", token);

let banner = null; // <-- single source of truth

if (user.userType === "mentor") {
  if (user.status === "pending") {
    banner = "Your mentor account is under review. You’re not visible in search or bookings yet.";
  } else if (user.status === "approved") {
    banner = "You are approved! You can now create sessions and start mentoring.";
  }
}

      logActivity({
        type: "USER",
        message: `User logged in: ${user.name} (${user.email})`,
        userId: user.id,
        status: "success"
      });

// ✅ SECURE: Set HTTP-only cookie (backend handles token, frontend doesn't see it)
res.cookie('authToken', token, {
  httpOnly: true,              // ← Can't be accessed from JavaScript (prevents XSS)
  secure: process.env.NODE_ENV === 'production',  // ← Only sent over HTTPS in production
  sameSite: 'lax',             // ← Prevents CSRF attacks
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days
});

// Optional: log what you're sending
return res.status(200).json({
  status: "success",
  message: "Login successful",
  token: token, // ← Return token for backward compatibility with localStorage code
  token_type: "Bearer",
  banner, // <-- this matches your frontend usage: result.banner
  user: {
    id: user.id,
    name: user.name,
    email: user.email,
    userType: user.userType,
    picture: user.picture || null,
    status: user.status,
    isOnline: user.mentor ? user.mentor.isOnline : false,

    // Safe optional fields if you loaded associations; otherwise they’ll be undefined (which is fine)
    expertise: user.mentor?.expertise,
    linkedinUrl: user.mentor?.linkedinUrl,
    bio: user.mentee?.bio ?? user.mentor?.bio,
  },
});

    } 
catch (error) {
      console.log("Login error:", error);
      res.status(500).json({ status: "fail", message: "Login failed", error: error.message });
    }
  };


  // controllers/authController.js
const logout = async (req, res) => {
  try {
    const { id, userType } = req.user; // decoded from JWT

    if (userType === "mentor") {
      await Mentor.update(
        { isOnline: false },
        { where: { user_id: id } }
      );
    }

    logActivity({
      type: "USER",
      message: `User logged out: ${req.user.name} (${req.user.email})`,
      userId: id,
      status: "success"
    });

    // ✅ SECURE: Clear HTTP-only cookie
    res.clearCookie('authToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });

    res.status(200).json({ status: "success", message: "Logged out" });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ status: "fail", message: "Logout failed" });
  }
};


  // Middleware to authenticate users using JWT
  const authentication = async (req, res, next) => {
    try {
      let idToken = "";
      
      // ✅ SECURE: Check Authorization header first (most common - includes localStorage tokens)
      if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
        idToken = req.headers.authorization.split(" ")[1];
      }
      // Fallback: Check HTTP-only cookie
      else if (req.cookies && req.cookies.authToken) {
        idToken = req.cookies.authToken;
      }

      if (!idToken) {
        return res.status(401).json({ status: "fail", message: "Please login to get access" });
      }
      
      // ✅ Trim any whitespace from token
      idToken = idToken.trim();
      
      // ✅ DEBUG: Log token format
      console.log("🔐 Token from request:", idToken.substring(0, 20) + "...", "Length:", idToken.length);

      const tokenDetails = jwt.verify(idToken, SECRET_KEY);
      console.log("AUTH DEBUG tokenDetails:", tokenDetails);

      const freshUser = await User.findOne({
        where: {
          [Op.or]: [{ id: tokenDetails.id }, { email: tokenDetails.email }],
        },
        include: [
          { model: Mentor, as: "mentor", required: false },
          { model: Mentee, as: "mentee", required: false },
        ],
        attributes: { exclude: ["password"] },
      });
      console.log("AUTH DEBUG freshUser:", freshUser ? "FOUND" : "NOT FOUND");

      if (!freshUser) {
        return res.status(400).json({ status: "fail", message: "User no longer exists" });
      }

req.user = freshUser;

// Add virtual fields for notifications
req.user.mentorId = freshUser.mentor?.id || null;
req.user.menteeId = freshUser.mentee?.id || null;

console.log("✅ Authenticated user:", {
  id: freshUser.id,
  email: freshUser.email,
  userType: freshUser.userType,
  status: freshUser.status,
  mentorId: req.user.mentorId,
  menteeId: req.user.menteeId,
});
      next();
    }catch (error) {
  console.error("JWT verification error:", error); // 🔍 log full error
  return res.status(401).json({
    status: "fail",
    message: "JWT: " + error.message, // send actual error message (optional)
  });
}
  };

  // Restrict access by role
 const restrictTo = (...userType) => {
  return (req, res, next) => {
    console.log("🟢 restrictTo called");
    console.log("Allowed types:", use rType);
    console.log("Current user from token:", req.user?.userType);

    if (!userType.includes(req.user.userType)) {
      console.warn("❌ Forbidden access. User type mismatch.");
      return res.status(403).json({
        status: "fail",
        message: `You don't have permission as a ${req.user.userType}`,
      });
    }
    next();
  };
};


  // ---------- Admin actions for mentor verification ----------

  // Approve a mentor (makes them searchable/bookable)
  const approveMentor = async (req, res) => {
    try {
      const { userId } = req.params;

      const user = await User.findByPk(userId);
      if (!user || user.userType !== "mentor") {
        return res.status(404).json({ status: "fail", message: "Mentor not found" });
      }

      await user.update({ status: "approved" });

      return res.status(200).json({
        status: "success",
        message: "Mentor approved successfully",
      });
    } catch (error) {
      return res.status(500).json({ status: "fail", message: error.message });
    }
  };

  // Reject a mentor → auto-switch to mentee
  const rejectMentor = async (req, res) => {
    const t = await User.sequelize.transaction(); // use same sequelize instance
    try {
      const { userId } = req.params;
      const { interests, shortBio } = req.body || {};

      const user = await User.findByPk(userId, { transaction: t });
      if (!user || user.userType !== "mentor") {
        await t.rollback();
        return res.status(404).json({ status: "fail", message: "Mentor not found" });
      }

      // Remove mentor profile (optional: you can soft-delete instead)
      await Mentor.destroy({ where: { user_id: userId }, transaction: t });

      // Switch role to mentee and approve
      await user.update({ userType: "mentee", status: "approved" }, { transaction: t });

      // Create mentee profile if not exists
      const existsMentee = await Mentee.findOne({ where: { user_id: userId }, transaction: t });
      if (!existsMentee) {
        await Mentee.create(
          {
            user_id: userId,
            interest: JSON.stringify(asArray(interests)), // can be empty array
            shortBio: shortBio || null,
          },
          { transaction: t }
        );
      }

      await t.commit();
      return res.status(200).json({
        status: "success",
        message: "Mentor application rejected. User switched to mentee.",
      });
    } catch (error) {
      await t.rollback();
      return res.status(500).json({ status: "fail", message: error.message });
    }
  };

  /**
   * Step 1: User submits email → generate 6-digit OTP → send email
   */
  const forgotPassword = async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ status: 'fail', message: 'Email is required' });

      const user = await User.findOne({ where: { email } });
      // Always return success to prevent email enumeration
      if (!user) {
        return res.status(200).json({ status: 'success', message: 'If this email exists, a reset code has been sent.' });
      }

      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      // Expire in 15 minutes
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await user.update({ 
        passwordResetToken: otp, 
        passwordResetExpires: expiresAt 
      });

      // Send email
      const templates = require('../utils/emailTemplates');
      await emailService.sendEmail({
        to: user.email,
        subject: 'Your WisdomIconnect Password Reset Code',
        html: templates.forgotPassword(user.name, otp)
      });

      return res.status(200).json({ status: 'success', message: 'Password reset code sent to your email.' });
    } catch (error) {
      console.error('Forgot password error:', error);
      return res.status(500).json({ status: 'fail', message: 'Failed to process request' });
    }
  };

  /**
   * Step 2: User submits email + OTP + newPassword → validate OTP → update password
   */
  const resetPassword = async (req, res) => {
    try {
      const { email, otp, newPassword, confirmPassword } = req.body;

      if (!email || !otp || !newPassword || !confirmPassword) {
        return res.status(400).json({ status: 'fail', message: 'All fields are required' });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({ status: 'fail', message: 'Passwords do not match' });
      }

      if (String(newPassword).length < 8) {
        return res.status(400).json({ status: 'fail', message: 'Password must be at least 8 characters' });
      }

      const user = await User.findOne({ where: { email } });
      if (!user) return res.status(404).json({ status: 'fail', message: 'User not found' });

      if (!user.passwordResetToken || user.passwordResetToken !== otp) {
        return res.status(400).json({ status: 'fail', message: 'Invalid reset code' });
      }

      if (!user.passwordResetExpires || new Date() > new Date(user.passwordResetExpires)) {
        return res.status(400).json({ status: 'fail', message: 'Reset code has expired. Please request a new one.' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, salt);
      await user.update({ 
        password: hashedPassword, 
        passwordResetToken: null, 
        passwordResetExpires: null 
      });

      return res.status(200).json({ status: 'success', message: 'Password reset successfully. You can now log in.' });
    } catch (error) {
      console.error('Reset password error:', error);
      return res.status(500).json({ status: 'fail', message: 'Failed to reset password' });
    }
  };

  const verifyEmail = async (req, res) => {
    try {
      // For POST requests from frontend, support req.body. For GET from email link, support req.query
      const email = req.body.email || req.query.email;
      const otp = req.body.otp || req.query.token;

      if (!email || !otp) return res.status(400).json({ status: "fail", message: "Missing email or OTP" });

      const user = await User.findOne({ 
        where: { email },
        include: [
          { model: Mentor, as: "mentor", required: false },
          { model: Mentee, as: "mentee", required: false },
        ]
      });

      if (!user) return res.status(404).json({ status: "fail", message: "User not found" });
      
      // If already verified
      if (user.isVerified) {
         return res.status(400).json({ status: "fail", message: "Email already verified" });
      }

      if (user.verificationToken !== otp) {
         return res.status(400).json({ status: "fail", message: "Invalid or expired OTP" });
      }

      await user.update({ isVerified: true, verificationToken: null });

      logActivity({
        type: "USER",
        message: `Email verified successfully: ${user.name} (${user.email})`,
        userId: user.id,
        status: "success"
      });

      // Send Welcome Notification now that they are verified
      const userResponse = user.get({ plain: true });
      delete userResponse.password;
      notificationService.sendWelcomeNotification(userResponse, user.userType).catch(err => console.error(err));

      // 💥 Automatically Log them in after verification! 💥
      let banner = null;
      if (user.userType === "mentor" && user.status === "pending") {
        banner = "Your mentor account is under review. You’re not visible in search or bookings yet.";
      }

      const tokenPayload = {
        id: user.id,
        email: user.email,
        userType: user.userType,
        status: user.status
      };
      const token = jwt.sign(tokenPayload, SECRET_KEY, { expiresIn: "7d" });

      return res.status(200).json({ 
         status: "success", 
         message: "Email verified successfully",
         token,
         banner,
         user: {
            id: user.id,
            name: user.name,
            email: user.email,
            userType: user.userType,
            picture: user.picture || null,
            status: user.status,
            isOnline: user.mentor ? user.mentor.isOnline : false,
            expertise: user.mentor?.expertise,
            linkedinUrl: user.mentor?.linkedinUrl,
            bio: user.mentee?.bio ?? user.mentor?.bio,
         }
      });
    } catch (error) {
      console.error("Email verification error:", error);
      res.status(500).json({ status: "fail", message: "Verification failed" });
    }
  };

  const resendVerification = async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ status: "fail", message: "Email is required" });

      const user = await User.findOne({ where: { email } });
      if (!user) return res.status(404).json({ status: "fail", message: "User not found" });

      if (user.isVerified) {
        return res.status(400).json({ status: "fail", message: "Email is already verified" });
      }

      const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();
      await user.update({ verificationToken });

      const userResponse = user.get({ plain: true });
      delete userResponse.password;

      notificationService.sendEmailVerification(userResponse, verificationToken).catch(err => console.error(err));

      return res.status(200).json({ status: "success", message: "Verification email resent successfully" });
    } catch (error) {
      console.error("Resend verification error:", error);
      res.status(500).json({ status: "fail", message: "Failed to resend verification email" });
    }
  };

  module.exports = {
    signup,
    logout,
    login,
    authentication,
    restrictTo,
    approveMentor,
    rejectMentor,
    forgotPassword,
    resetPassword,
    verifyEmail,
    resendVerification,
  };
