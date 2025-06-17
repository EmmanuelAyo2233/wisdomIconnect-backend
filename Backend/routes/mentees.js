const { express } = require("../config/reuseablePackages");
const {
    authentication,
    restrictTo,
} = require("../controllers/authcontrollers");
const {
    getAllMentors,
    getMentorsDetails,
    bookApppointment,
    resceduleAppointment,
    cancelAppointment,
    deleteAppointment,
    apppointmentLists,
} = require("../controllers/menteescontroller");

const router = express();

// Route to get all mentors
router.route("/").get(authentication, restrictTo("mentee"), getAllMentors);
// Route to get mentor details
router
    .route("/:id")
    .get(authentication, restrictTo("mentee"), getMentorsDetails);
// Route to book an appointment
router
    .route("/:id/book")
    .post(authentication, restrictTo("mentee"), bookApppointment);

// route to get all appointment that was created by the mentee
router
    .route("/my/appointments")
    .get(authentication, restrictTo("mentee"), apppointmentLists);

// Route to reschedule an appointment
router
    .route("/:id/reschedule")
    .patch(authentication, restrictTo("mentee"), resceduleAppointment);

// Route to cancel an appointment
router
    .route("/:id/cancel")
    .patch(authentication, restrictTo("mentee"), cancelAppointment);

// Route to delete an appointment
router
    .route("/:id/delete")
    .delete(authentication, restrictTo("mentee"), deleteAppointment);

module.exports = router;
