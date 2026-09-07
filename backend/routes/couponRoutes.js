const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { validateCoupon } = require('../controllers/couponController');

// Coupon has no guest concept (usage limits are tracked per-user) — same
// convention as wishlistRoutes.js/addressRoutes.js.
router.use(protect);

router.post('/validate', validateCoupon);

module.exports = router;
