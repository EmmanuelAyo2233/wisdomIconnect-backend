const express = require("express");
const router = express.Router();
const { authentication: auth } = require("../controllers/authcontrollers");
const { verifyCallAccess } = require("../controllers/callController");

router.get("/:meetingId", auth, verifyCallAccess);

module.exports = router;
