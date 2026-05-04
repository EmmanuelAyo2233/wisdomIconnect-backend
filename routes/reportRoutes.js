const { express } = require("../config/reuseablePackages");
const { authentication, restrictTo } = require("../controllers/authcontrollers");
const {
  submitReport,
  getAllReports,
  updateReportStatus
} = require("../controllers/reportController");

const router = express.Router();

router.use(authentication);

// Any authenticated user
router.post('/', submitReport);

// Admin only
router.get('/admin', restrictTo('admin'), getAllReports);
router.patch('/admin/:reportId', restrictTo('admin'), updateReportStatus);

module.exports = router;
