const express = require("express");
const router = express.Router();
const { getAllMentors, getMentorsDetails } = require("../controllers/mentorController");
const { authentication, restrictTo } = require("../controllers/authcontrollers");

router.get("/explore", authentication, restrictTo("mentee", "mentor", "admin"), getAllMentors);

router.get("/:id", authentication, restrictTo("mentee", "mentor", "admin"), getMentorsDetails);

module.exports = router;