const { otp: generateOtp, hashCode, publicUser, accountEligible } = require('../utils/security');
  const { db, User, Mentee, Mentor } = require("../models");
  const { logActivity } = require("../services/activityLogger");
  const {
    bcrypt,
    EMAIL_REGEX,
    salt,
    SECRET_KEY,
    jwt,
    Op,
  } = require("../config/reuseablePackages");
  const { cloudinary } = require("../utils/cloudinary");
  const streamFier = require("streamifier");
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
      if(typeof b.email === "string") b.email = b.email.trim().toLowerCase();
      if(typeof b.password !== "string" || Buffer.byteLength(b.password,"utf8") > 72 || typeof b.name !== "string" || b.name.trim().length > 150) return res.status(400).json({status:"fail",message:"Invalid name or password"});

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
          require("../utils/uploadValidation").validateFile(req.file);
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
        const verificationToken = generateOtp();
        const verificationExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        const { newUser, mentor } = await db.sequelize.transaction(async transaction => {
const newUser = await User.create({
          name: b.name,
          email: b.email,
          password: hashedPassword,
          userType: "mentor",
          status: "pending", // pending approval
          verificationToken: hashCode(verificationToken),
          verificationExpires,
          isVerified: false,
        }, { transaction });

        const shortBio = b.shortBio || b.bio || null;

        if (certUrl) {
            expertise.push(`CERTIFICATE_URL_${certUrl}`);
        }

        const mentor = await Mentor.create({
          user_id: newUser.id,
          role: b.occupation || b.role || null,
          yearsOfExperience: b.yearsOfExperience || b.experience || 0,
          bio: shortBio,   // ✅ correct column
          expertise: JSON.stringify(expertise),
          discipline: JSON.stringify(disciplines),
          industries: JSON.stringify(industries),
          fluentIn: JSON.stringify(fluentIn),
          linkedinUrl: b.linkedinUrl || null,
        }, { transaction });
return {newUser,mentor};
});

      const userResponse = publicUser(newUser);
      delete userResponse.password;

      // Send Verification Email
      notificationService.sendEmailVerification(userResponse, verificationToken).catch(err => require('../utils/logger').error("Notification Error:", err));

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

      const verificationToken = generateOtp();
      const verificationExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      const { newUser, mentee } = await db.sequelize.transaction(async transaction => {
const newUser = await User.create({
        name: b.name,
        email: b.email,
        password: hashedPassword,
        userType: "mentee",
        status: "approved", // mentees auto-approved
        verificationToken: hashCode(verificationToken),
        verificationExpires,
        isVerified: false,
      }, { transaction });

      const mentee = await Mentee.create({
          user_id: newUser.id,
          role: b.occupation || b.role || null,
          bio: shortBio,
          interest: JSON.stringify(interests),
          expertise: JSON.stringify(expertise),
          discipline: JSON.stringify(disciplines),
          industries: JSON.stringify(industries),
          fluentIn: JSON.stringify(fluentIn),
      }, { transaction });
return {newUser,mentee};
});


      const userResponse = publicUser(newUser);
      delete userResponse.password;

      // Send Verification Email
      notificationService.sendEmailVerification(userResponse, verificationToken).catch(err => require('../utils/logger').error("Notification Error:", err));

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
    });
  }
};
  // Handles user login
  const login = async (req, res) => {
    try {
      const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
      const password = req.body.password;
      if (typeof password !== "string" || Buffer.byteLength(password,"utf8") > 72) return res.status(400).json({message:"Invalid credentials"});

      if (!email || !password) {
        return res.status(400).json({ status: "fail", message: "Email and password are required" });
      }
      if (!EMAIL_REGEX.test(email)) {
        return res.status(400).json({ status: "fail", message: "Invalid email address" });
      }

      const user = await User.findOne({
        where: { email },
        include: [
          { model: Mentor, as: "mentor", required: false },
          { model: Mentee, as: "mentee", required: false },
        ]
      });
      if (!user) {
        return res.status(401).json({ status: "fail", message: "Invalid email or password" });
      }

      const ok = await bcrypt.compare(password, user.password);
      if (!ok) {
        return res.status(401).json({ status: "fail", message: "Invalid email or password" });
      }

      if (user.accountStatus === "suspended" || user.accountStatus === "banned" || user.status === "banned") {
        return res.status(403).json({ status: "fail", message: "Your account has been suspended or banned. Please contact support." });
      }

      if (!user.isVerified) return res.status(403).json({ status: "fail", requiresVerification: true, message: "Please verify your email before signing in." });

      if (user.userType === "mentor") {
        await Mentor.update(
          { isOnline: true },
          { where: { user_id: user.id } }
        );
      }

      const tokenPayload = {
        id: user.id,
        email: user.email,
        userType: user.userType,
        status: user.status,
        tokenVersion: user.tokenVersion || 0
      };

      const token = jwt.sign(tokenPayload, SECRET_KEY, { expiresIn: "12h", algorithm: "HS256" });

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

// Optional: log what you're sending
return res.status(200).json({
  status: "success",
  message: "Login successful",
  token,
  token_type: "Bearer",
  banner, // <-- this matches your frontend usage: result.banner
  user: {
    id: user.id,
    name: user.name,
    email: user.email,
    userType: user.userType,
    picture: user.picture || null,
    status: user.status,
    role: user.mentor?.role ?? user.mentee?.role ?? (user.userType === 'mentor' ? 'Professional Mentor' : 'Mentee'),
    occupation: user.mentor?.role ?? user.mentee?.role ?? (user.userType === 'mentor' ? 'Professional Mentor' : 'Mentee'),
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
      res.status(500).json({ status: "fail", message: "Login failed",});
    }
  };


  // controllers/authController.js
const logout = async (req, res) => {
  try {
    const { id, userType } = req.user;
    await User.increment("tokenVersion", { where: { id } }); // decoded from JWT

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

    res.status(200).json({ status: "success", message: "Logged out" });
  } catch (err) {
    require('../utils/logger').error("Logout error:", err);
    res.status(500).json({ status: "fail", message: "Logout failed" });
  }
};


  // Middleware to authenticate users using JWT
  const authentication = async (req, res, next) => {
    try {
      let idToken = "";
      if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
        idToken = req.headers.authorization.split(" ")[1].trim();
      }

      if (!idToken) {
        return res.status(401).json({ status: "fail", message: "Please login to get access" });
      }

      const tokenDetails = jwt.verify(idToken, SECRET_KEY, { algorithms: ["HS256"] });

      const freshUser = await User.findOne({
        where: {
          id: tokenDetails.id,
        },
        include: [
          { model: Mentor, as: "mentor", required: false },
          { model: Mentee, as: "mentee", required: false },
        ],
        attributes: { exclude: ["password"] },
      });

      if (!accountEligible(freshUser) || Number(freshUser.tokenVersion || 0) !== Number(tokenDetails.tokenVersion || 0)) {
        return res.status(401).json({ status: "fail", message: "Session expired. Please sign in again." });
      }

      req.user = freshUser;
      req.user.mentorId = freshUser.mentor?.id || null;
      req.user.menteeId = freshUser.mentee?.id || null;

      next();
    } catch (error) {
      return res.status(401).json({ status: "fail", message: "Invalid or expired token" });
    }
  };

  // Restrict access by role
const restrictTo = (...userType) => {
  return (req, res, next) => {
    if (!userType.includes(req.user.userType)) {
      return res.status(403).json({
        status: "fail",
        message: `You don't have permission as a ${req.user.userType}`,
      });
    }
    next();
  };
};


  // Legacy endpoints use the same transactional admin policy.
  const approveMentor = (req,res) => {req.params.id=req.params.userId;return require('./adminController').approveMentor(req,res);};
  const rejectMentor = (req,res) => {req.params.id=req.params.userId;return require('./adminController').rejectMentor(req,res);};

  /**
   * Step 1: User submits email → generate 6-digit OTP → send email
   */
  const forgotPassword = async (req, res) => {
    try {
      const email=typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      if (!EMAIL_REGEX.test(email)) return res.status(400).json({status:'fail',message:'Valid email is required'});

      const user = await User.findOne({ where: { email } });
      // Always return success to prevent email enumeration
      if (!user) {
        return res.status(200).json({ status: 'success', message: 'If this email exists, a reset code has been sent.' });
      }

      // Generate 6-digit OTP
      const otp = generateOtp();
      // Expire in 15 minutes
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await user.update({ 
        passwordResetToken: hashCode(otp), 
        passwordResetExpires: expiresAt 
      });

      // Send email
      const templates = require('../utils/emailTemplates');
      await emailService.sendEmail({
        to: user.email,
        subject: 'Your Wisicom Password Reset Code',
        html: templates.forgotPassword(user.name, otp)
      });

      return res.status(200).json({ status: 'success', message: 'If this email exists, a reset code has been sent.' });
    } catch (error) {
      require('../utils/logger').error('Forgot password error:', error);
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

      if (typeof newPassword !== 'string' || newPassword.length < 8 || Buffer.byteLength(newPassword,'utf8') > 72) {
        return res.status(400).json({ status: 'fail', message: 'Password must be at least 8 characters' });
      }

      const user = await User.findOne({ where: { email } });
      if (!user) return res.status(404).json({ status: 'fail', message: 'User not found' });

      if (!user.passwordResetToken || user.passwordResetToken !== hashCode(otp)) {
        return res.status(400).json({ status: 'fail', message: 'Invalid reset code' });
      }

      if (!user.passwordResetExpires || new Date() > new Date(user.passwordResetExpires)) {
        return res.status(400).json({ status: 'fail', message: 'Reset code has expired. Please request a new one.' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, salt);
      const [changed] = await User.update({ 
        password: hashedPassword, 
        tokenVersion: (user.tokenVersion || 0) + 1,
        passwordResetToken: null, 
        passwordResetExpires: null
      }, {where:{id:user.id,passwordResetToken:hashCode(otp),passwordResetExpires:{[Op.gt]:new Date()},tokenVersion:user.tokenVersion}});
      if (!changed) return res.status(400).json({status:'fail',message:'Invalid or expired reset code'});

      return res.status(200).json({ status: 'success', message: 'Password reset successfully. You can now log in.' });
    } catch (error) {
      require('../utils/logger').error('Reset password error:', error);
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

      if (user.verificationToken !== hashCode(otp)) {
         return res.status(400).json({ status: "fail", message: "Invalid or expired OTP" });
      }

      if (user.verificationExpires && new Date() > new Date(user.verificationExpires)) {
         return res.status(400).json({ status: "fail", message: "Verification code has expired. Please request a new one." });
      }

      const [changed] = await User.update({isVerified:true,verificationToken:null,verificationExpires:null},{where:{id:user.id,isVerified:false,verificationToken:hashCode(otp),verificationExpires:{[Op.gt]:new Date()}}});
      if (!changed) return res.status(400).json({status:'fail',message:'Invalid or expired verification code'});
      user.isVerified=true;user.verificationToken=null;user.verificationExpires=null;

      logActivity({
        type: "USER",
        message: `Email verified successfully: ${user.name} (${user.email})`,
        userId: user.id,
        status: "success"
      });

      // Send Appropriate Notification now that they are verified
      const userResponse = publicUser(user);
      delete userResponse.password;
      if (user.userType === "mentor") {
        notificationService.sendMentorApplicationReceived(userResponse).catch(err => require('../utils/logger').error(err));
      } else {
        notificationService.sendWelcomeNotification(userResponse, user.userType).catch(err => require('../utils/logger').error(err));
      }

      // 💥 Automatically Log them in after verification! 💥
      let banner = null;
      if (user.userType === "mentor" && user.status === "pending") {
        banner = "Your mentor account is under review. You’re not visible in search or bookings yet.";
      }

      const tokenPayload = {
        id: user.id,
        email: user.email,
        userType: user.userType,
        status: user.status,
        tokenVersion: user.tokenVersion || 0
      };
      const token = jwt.sign(tokenPayload, SECRET_KEY, { expiresIn: "12h", algorithm: "HS256" });

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
            role: user.mentor?.role ?? user.mentee?.role ?? (user.userType === 'mentor' ? 'Professional Mentor' : 'Mentee'),
            occupation: user.mentor?.role ?? user.mentee?.role ?? (user.userType === 'mentor' ? 'Professional Mentor' : 'Mentee'),
            isOnline: user.mentor ? user.mentor.isOnline : false,
            expertise: user.mentor?.expertise,
            linkedinUrl: user.mentor?.linkedinUrl,
            bio: user.mentee?.bio ?? user.mentor?.bio,
         }
      });
    } catch (error) {
      require('../utils/logger').error("Email verification error:", error);
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

      const verificationToken = generateOtp();
      const verificationExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      await user.update({ verificationToken: hashCode(verificationToken), verificationExpires });

      const userResponse = publicUser(user);
      delete userResponse.password;

      notificationService.sendEmailVerification(userResponse, verificationToken).catch(err => require('../utils/logger').error(err));

      return res.status(200).json({ status: "success", message: "Verification email resent successfully" });
    } catch (error) {
      require('../utils/logger').error("Resend verification error:", error);
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
