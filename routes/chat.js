const { express } = require("../config/reuseablePackages");
const { authentication } = require("../controllers/authcontrollers");
const { getAllChatAccesscode } = require("../controllers/chatcontroller");

const router = express.Router();

// get chat access database
router.route("/").get(authentication, getAllChatAccesscode);

module.exports = router;
