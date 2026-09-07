const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getWishlist,
  getWishlistStatus,
  addToWishlist,
  removeFromWishlist,
  moveToCart,
} = require('../controllers/wishlistController');

// Wishlist has no guest concept (see models/Wishlist.js) — every route
// requires login, unlike Cart's optionalAuth.
router.use(protect);

router.get('/', getWishlist);
router.get('/status', getWishlistStatus);
router.post('/', addToWishlist);
router.delete('/:productId', removeFromWishlist);
router.post('/:productId/move-to-cart', moveToCart);

module.exports = router;
