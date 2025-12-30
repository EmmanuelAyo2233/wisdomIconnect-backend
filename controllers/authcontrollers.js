  // controllers/authController.js
  const { User, Mentee, Mentor } = require("../models");
  const {
    bcrypt,
    EMAIL_REGEX,
    salt,
    SECRET_KEY,
    jwt,
    Op,
  } = require("../config/reuseablePackages");

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
        const expertise = asArray(b.expertise || b.topics); // up to 3
        if (!b.yearsOfExperience) {
          return res.status(400).json({ status: "fail", message: "Years of experience is required" });
        }
        if (!expertise.length) {
          return res.status(400).json({ status: "fail", message: "Select at least 1 expertise topic" });
        }
        if (expertise.length > 3) {
          return res.status(400).json({ status: "fail", message: "Select up to 3 expertise topics" });
        }

        // Create user with pending status (mentor verification)
       
      const newUser = await User.create({
        name: b.name,
        email: b.email,
        password: hashedPassword,
        userType: "mentor",
        status: "pending", // pending approval
      });

     const shortBio = b.shortBio || b.bio || null;

    const mentor = await Mentor.create({
      user_id: newUser.id,
      yearsOfExperience: b.yearsOfExperience || 0,
      bio: shortBio,   // ✅ correct column
      expertise: JSON.stringify(expertise),
      linkedinUrl: b.linkedinUrl || null,
    });


      const userResponse = newUser.get({ plain: true });
      delete userResponse.password;

      return res.status(201).json({
        status: "success",
        message: "Mentor registration submitted. Your account is under review.",
        banner: "Your account is under review. You’ll be available in search & bookings once approved.",
        data: { user: userResponse, mentor },
      });

    } else if (b.userType === "mentee") {
      // Mentee flow
      const interests = Array.isArray(b.interests) ? b.interests : [];
      if (!interests.length) {
        return res.status(400).json({ status: "fail", message: "Select at least 1 interest" });
      }
      if (interests.length > 5) {
        return res.status(400).json({ status: "fail", message: "Select up to 5 interests" });
      }

      const newUser = await User.create({
        name: b.name,
        email: b.email,
        password: hashedPassword,
        userType: "mentee",
        status: "approved", // mentees auto-approved
      });

      const mentee = await Mentee.create({
      user_id: newUser.id,
      bio: shortBio, // ✅ map to correct DB column
      interest: JSON.stringify(interests),
  });


      const userResponse = newUser.get({ plain: true });
      delete userResponse.password;

      return res.status(201).json({
        status: "success",
        message: "Mentee registration successful",
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
      if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
        idToken = req.headers.authorization.split(" ")[1];
      }

      if (!idToken) {
        return res.status(401).json({ status: "fail", message: "Please login to get access" });
      }


      const tokenDetails = jwt.verify(idToken, SECRET_KEY);

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

      if (!freshUser) {
        return res.status(400).json({ status: "fail", message: "User no longer exists" });
      }

      req.user = freshUser;
      console.log("✅ Authenticated user:", {
  id: freshUser.id,
  email: freshUser.email,
  userType: freshUser.userType,
  status: freshUser.status,
});
      next();
    }catch (error) {
  console.error("JWT verification error:", error); // 🔍 log full error
  return res.status(401).json({
    status: "fail",
    message: error.message, // send actual error message (optional)
  });
}
  };

  // Restrict access by role
 const restrictTo = (...userType) => {
  return (req, res, next) => {
    console.log("🟢 restrictTo called");
    console.log("Allowed types:", userType);
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

  const resetPassword = async (req, res) => { };

  module.exports = {
    signup,
    logout,
    login,
    authentication,
    restrictTo,
    approveMentor,
    rejectMentor,
    resetPassword,
  };
