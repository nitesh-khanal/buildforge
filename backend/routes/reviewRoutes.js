const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getProductReviews,
  getMyReview,
  createReview,
  updateReview,
  deleteReview,
} = require('../controllers/reviewController');

// Mounted at /api/products in app.js, alongside (not instead of)
// productRoutes.js — kept as its own file/controller per this project's
// one-feature-per-phase convention rather than growing productRoutes.js.
router.get('/:id/reviews', getProductReviews);
router.get('/:id/reviews/mine', protect, getMyReview);
router.post('/:id/reviews', protect, createReview);
router.put('/:id/reviews', protect, updateReview);
router.delete('/:id/reviews', protect, deleteReview);

module.exports = router;
