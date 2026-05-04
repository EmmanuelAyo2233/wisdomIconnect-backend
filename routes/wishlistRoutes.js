const { express } = require("../config/reuseablePackages");
const { authentication, restrictTo } = require("../controllers/authcontrollers");
const {
  toggleWishlist,
  getWishlist,
  checkWishlist
} = require("../controllers/wishlistController");

const router = express.Router();

// All routes require authentication
router.use(authentication);

// Wishlist (mentees only)
router.get('/wishlist', restrictTo('mentee'), getWishlist);
router.get('/wishlist/check/:mentorId', restrictTo('mentee'), checkWishlist);
router.post('/wishlist/:mentorId', restrictTo('mentee'), toggleWishlist);



module.exports = router;
