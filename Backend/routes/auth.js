const {express} = require('../config/reuseablePackages')
const {signup, login} = require('../controllers/authcontrollers')

const router = express.Router()

// Route for user registration
router.route('/register').post(signup)

// Route for user login
router.route('/login').post(login)


module.exports = router