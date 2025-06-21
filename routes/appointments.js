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
    addAvailableDate,
    getAllAvailabilityDate,
    deleteAvailability,
    updateAvailability,
} = require("../controllers/appointments");

const router = express.Router();

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

// Route to add available appointment date and time
router
    .route("/add/availabledate")
    .post(authentication, restrictTo("mentor"), addAvailableDate);

// Route to get all available dates and time
router
    .route("/availabilities")
    .get(authentication, restrictTo("mentor"), getAllAvailabilityDate);

// Route to update availability date and time
router
    .route("/update/availability/:id")
    .patch(authentication, restrictTo("mentor"), updateAvailability);

router
    .route("/delete/availability/:id")
    .delete(authentication, restrictTo("mentor"), deleteAvailability);

module.exports = router;
