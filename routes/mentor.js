const express = require("express");
const router = express.Router();
const { getAllMentors, getMentorsDetails } = require("../controllers/mentorController");
const { authentication, restrictTo } = require("../controllers/authcontrollers");

router.get("/explore", authentication, restrictTo("mentee"), getAllMentors);

router.get("/:id", authentication, restrictTo("mentee"), getMentorsDetails);

module.exports = router;