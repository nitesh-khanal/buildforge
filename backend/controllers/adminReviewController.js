const Review = require('../models/Review');
const Product = require('../models/Product');
const asyncHandler = require('../utils/asyncHandler');
const { recalculateProductRating } = require('../services/ratingService');

// GET /api/admin/reviews?status=&product=&rating=&search=&page=&limit=
const listReviews = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.product) filter.product = req.query.product;
  if (req.query.rating) filter.rating = Number(req.query.rating);

  const [reviews, total] = await Promise.all([
    Review.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('user', 'name email')
      .populate('product', 'name image category'),
    Review.countDocuments(filter),
  ]);

  res.json({
    success: true,
    reviews,
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
  });
});

// PATCH /api/admin/reviews/:id/hide  { reason? }
const hideReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) {
    res.status(404);
    throw new Error('Review not found.');
  }

  review.status = 'hidden';
  review.moderatedBy = req.user._id;
  review.moderatedAt = new Date();
  review.moderationReason = req.body.reason || '';
  await review.save();

  await recalculateProductRating(Review, Product, review.product);

  res.json({ success: true, review });
});

// PATCH /api/admin/reviews/:id/unhide
const unhideReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) {
    res.status(404);
    throw new Error('Review not found.');
  }

  review.status = 'visible';
  review.moderatedBy = req.user._id;
  review.moderatedAt = new Date();
  review.moderationReason = '';
  await review.save();

  await recalculateProductRating(Review, Product, review.product);

  res.json({ success: true, review });
});

module.exports = { listReviews, hideReview, unhideReview };
