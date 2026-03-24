const express = require("express");
const router = express.Router();
const connectionController = require("../controllers/connectionController");
const { authentication, restrictTo } = require("../controllers/authcontrollers");

router.post("/request/:mentorUserId", authentication, restrictTo("mentee"), connectionController.requestConnection);
router.put("/respond/:connectionId", authentication, restrictTo("mentor"), connectionController.respondConnection);
router.get("/", authentication, connectionController.getConnections);

module.exports = router;
