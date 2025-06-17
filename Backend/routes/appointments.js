const { express } = require("../config/reuseablePackages");
const {
    authentication,
    restrictTo,
} = require("../controllers/authcontrollers");
const {
    getAllAppointments,
    confirmAppointment,
    rescheduleAppointment,
    cancelAppointment,
    deleteAppointment,
} = require("../controllers/appointments");

const router = express();

// Route to get all appointments
router.route("/").get(authentication, restrictTo("mentor"), getAllAppointments);
// Route to confirm an appointment
router
    .route("/:id/confirm")
    .patch(authentication, restrictTo("mentor"), confirmAppointment);
// Route to reschedule an appointment
router
    .route("/:id/reschedule")
    .patch(authentication, restrictTo("mentor"), rescheduleAppointment);
// Route to cancel an appointment
router
    .route("/:id/cancel")
    .patch(authentication, restrictTo("mentor"), cancelAppointment);

// Route to delete an appointment
router
    .route("/:id/delete")
    .delete(authentication, restrictTo("mentor"), deleteAppointment);

module.exports = router;
