const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { listReviews, hideReview, unhideReview } = require('../controllers/adminReviewController');

router.use(protect, authorize('admin'));

router.get('/', listReviews);
router.patch('/:id/hide', hideReview);
router.patch('/:id/unhide', unhideReview);

module.exports = router;
