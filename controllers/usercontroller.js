const { CLOUDINARY_FOLDER_NAME } = require("../config/reuseablePackages");
const { User, Mentee, Mentor } = require("../models");
const { cloudinary } = require("../utils/cloudinary");
const streamifier = require("streamifier");

// Helper to safely parse JSON or fallback to array
const safeParseJSON = (value) => {
  try {
    return value ? JSON.parse(value) : [];
  } catch {
    return [];
  }
};

// --- Get user details ---
const getdetails = async (req, res) => {
  try {
    const user = req.user;
    let extraInfo = {};

    if (user.userType === "mentor" && user.mentor) {
      extraInfo = user.mentor.dataValues;
    } else if (user.userType === "mentee" && user.mentee) {
      extraInfo = user.mentee.dataValues;
    }

    const userData = {
      id: user.id,
      name: user.name || "",
      email: user.email || "",
      userType: user.userType || "",
      status: user.status || "",
      picture: user.picture || null,
      bio: extraInfo.bio || "",
      role: extraInfo.role || "",
      phone: extraInfo.phone || "",
      linkedinUrl: extraInfo.linkedinUrl || "",
      expertise: safeParseJSON(extraInfo.expertise) || [],
      fluentIn: safeParseJSON(extraInfo.fluentIn) || [],
      industries: safeParseJSON(extraInfo.industries) || [],
      experience: safeParseJSON(extraInfo.experience) || [], // array of objects
      interest: extraInfo.interest || [],
      discipline: safeParseJSON(extraInfo.discipline) || [],
      education: safeParseJSON(extraInfo.education) || [],
      yearsOfExperience: extraInfo.yearsOfExperience || 0,
      experienceDescription: extraInfo.experienceDescription || "",
    };

    return res.status(200).json({
      status: "success",
      message: "Fetched user details successfully",
      data: userData,
    });
  } catch (err) {
    console.error("Error in getdetails:", err);
    res.status(500).json({
      status: "fail",
      message: "Failed to fetch user details",
      error: err.message,
    });

};

  fetch("/api/getdetails", { credentials: "include" })
  .then(res => res.json())
  .then(data => {
    console.log("User data from backend:", data); // 👀 check if picture is correct
    if (data.picture) {
      document.getElementById("profileImg").src = data.picture;
    }
  });

};

// --- Update user details ---
const updateDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const body = req.body;

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ status: "error", message: "User not found" });

    // Update base User fields only if provided
    user.name = body.name || user.name;
    user.email = body.email || user.email;
    if (body.password) user.password = body.password;
    await user.save();

    // Update Mentor or Mentee
    if (user.userType === "mentor") {
      const mentor = await Mentor.findOne({ where: { user_id: userId } });
      if (mentor) {
        mentor.bio = body.bio || mentor.bio;
        mentor.experienceDescription = body.experienceDescription || mentor.experienceDescription;
        mentor.gender = body.gender || mentor.gender;
        mentor.role = body.role || mentor.role;
        mentor.yearsOfExperience = body.yearsOfExperience ?? mentor.yearsOfExperience ?? 0;
        mentor.available = body.available ?? mentor.available;
        mentor.slotBooked = body.slotBooked ?? mentor.slotBooked;
        mentor.phone = body.phone || mentor.phone;
        mentor.linkedInUrl = body.linkedInUrl || mentor.linkedInUrl || "";
        mentor.expertise = JSON.stringify(body.expertise || safeParseJSON(mentor.expertise));
        mentor.fluentIn = JSON.stringify(body.fluentIn || safeParseJSON(mentor.fluentIn));
        mentor.discipline = JSON.stringify(body.disciplines || safeParseJSON(mentor.discipline));
        mentor.education = JSON.stringify(body.education || safeParseJSON(mentor.education));
       mentor.experience = JSON.stringify(body.experience || safeParseJSON(mentor.experience));
        mentor.startDate = body.startDate || mentor.startDate;
        mentor.endDate = body.endDate || mentor.endDate;

        await mentor.save();
      }
    } else if (user.userType === "mentee") {
  const mentee = await Mentee.findOne({ where: { user_id: userId } });
  if (mentee) {
    mentee.bio = body.bio || mentee.bio;
    mentee.gender = body.gender || mentee.gender;
    mentee.role = body.role || mentee.role;
    mentee.phone = body.phone || mentee.phone;
    mentee.fluentIn = JSON.stringify(body.fluentIn || safeParseJSON(mentee.fluentIn));
  mentee.interests = JSON.stringify(body.interests || safeParseJSON(mentee.interests));
    
    // New fields
    mentee.expertise = JSON.stringify(body.expertise || safeParseJSON(mentee.expertise));
    mentee.industries = JSON.stringify(body.industries || safeParseJSON(mentee.industries));
   mentee.experience = JSON.stringify(body.experience || safeParseJSON(mentee.experience));


    mentee.startDate = body.startDate || mentee.startDate;
    mentee.endDate = body.endDate || mentee.endDate;

    await mentee.save();
  }
}
console.log("Updating userId:", userId, "userType:", user.userType, "body:", body);


    return res.status(200).json({
      status: "success",
      message: "User details updated successfully",
    });
  } catch (err) {
    console.error("Update profile error:", err);
    return res.status(500).json({
      status: "error",
      message: "Failed to update details",
      error: err.message,
    });
  }

  
};
const uploadprofilePicture = async (req, res) => {
  try {
    const user = req.user;
    const file = req.file;

    if (!file || !file.buffer) {
      return res.status(400).json({ status: "fail", message: "No image provided" });
    }

    const publicId = `emmanuel_profile_${user.id}`; // stable id per user

    const stream = cloudinary.uploader.upload_stream(
      {
        folder: CLOUDINARY_FOLDER_NAME,
        resource_type: "image",
        public_id: publicId,
        overwrite: true,
        invalidate: true, // ✅ ask CDN to invalidate cached version
      },
      async (error, result) => {
        if (error) {
          console.error("Cloudinary upload error:", error);
          return res.status(500).json({ status: "error", message: "Cloudinary upload failed" });
        }

        const imageUrl = result.secure_url; // has a new /v####/ version every overwrite

        // ✅ write to the right column
        const [updatedRows] = await User.update(
          { picture: imageUrl },
          { where: { id: user.id } }
        );

        if (updatedRows === 0) {
          return res.status(404).json({ status: "fail", message: "User not found" });
        }

        return res.status(200).json({
          status: "success",
          message: "Profile picture updated successfully",
          imageUrl,
        });
      }
    );

    streamifier.createReadStream(file.buffer).pipe(stream);
  } catch (err) {
    console.error("Upload profile picture error:", err);
    return res.status(500).json({
      status: "error",
      message: "Failed to update profile picture",
      error: err.message,
    });
  }
};

// --- Delete authenticated user account ---
const deleteAccount = async (req, res) => {
  try {
    const useremail = req.user.email;

    const user = await User.findOne({
      where: { email: req.user.email },
      include: [
        { model: Mentee, as: "mentee", required: false },
        { model: Mentor, as: "mentor", required: false },
      ],
    });

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    if (useremail !== user.email) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized",
      });
    }

    await user.destroy();

    return res.status(201).json({
      status: "success",
      message: "Account deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Failed to delete account",
      error: error.message,
    });
  }
};

module.exports = {
  getdetails,
  updateDetails,
  uploadprofilePicture,
  deleteAccount,
};
