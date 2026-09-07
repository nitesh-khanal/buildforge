const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');
const asyncHandler = require('../utils/asyncHandler');
const { validateReviewInput } = require('../validators/reviewValidator');
const { recalculateProductRating } = require('../services/ratingService');

// A review counts as "verified purchase" if the reviewer has a confirmed
// order (Paid or COD — same rule analytics uses) containing this product,
// either bought standalone or as a component inside a saved custom build.
// Never trust a client-supplied flag for this — always re-derive it here.
async function hasVerifiedPurchase(userId, productId) {
  const order = await Order.exists({
    user: userId,
    paymentStatus: { $in: ['Paid', 'COD'] },
    $or: [{ 'items.product': productId }, { 'items.buildComponents.product': productId }],
  });
  return Boolean(order);
}

// GET /api/products/:id/reviews?sort=newest|highest|lowest&page=&limit=
const getProductReviews = asyncHandler(async (req, res) => {
  const productId = req.params.id;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));

  const sortMap = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    highest: { rating: -1, createdAt: -1 },
    lowest: { rating: 1, createdAt: -1 },
  };
  const sort = sortMap[req.query.sort] || sortMap.newest;

  const filter = { product: productId, status: 'visible' };
  const [reviews, total, product] = await Promise.all([
    Review.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('user', 'name'),
    Review.countDocuments(filter),
    Product.findById(productId).select('rating numReviews ratingDistribution'),
  ]);

  res.json({
    success: true,
    reviews,
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
    summary: product
      ? {
          rating: product.rating,
          numReviews: product.numReviews,
          ratingDistribution: product.ratingDistribution,
        }
      : null,
  });
});

// GET /api/products/:id/reviews/mine — the current user's own review for
// this product, if any (used by the frontend to show "edit" vs "write a
// review"), plus whether they're eligible to write one at all.
const getMyReview = asyncHandler(async (req, res) => {
  const [review, verifiedPurchase] = await Promise.all([
    Review.findOne({ product: req.params.id, user: req.user._id }),
    hasVerifiedPurchase(req.user._id, req.params.id),
  ]);
  res.json({ success: true, review, verifiedPurchase });
});

// POST /api/products/:id/reviews  { rating, title?, comment? }
const createReview = asyncHandler(async (req, res) => {
  const productId = req.params.id;

  const errors = validateReviewInput(req.body);
  if (errors.length) {
    res.status(400);
    throw new Error(errors.join(' '));
  }

  const product = await Product.findById(productId);
  if (!product) {
    res.status(404);
    throw new Error('Product not found.');
  }

  const existing = await Review.findOne({ product: productId, user: req.user._id });
  if (existing) {
    res.status(400);
    throw new Error('You already reviewed this product — edit your existing review instead.');
  }

  const verifiedPurchase = await hasVerifiedPurchase(req.user._id, productId);

  const review = await Review.create({
    product: productId,
    user: req.user._id,
    rating: req.body.rating,
    title: req.body.title || '',
    comment: req.body.comment || '',
    verifiedPurchase,
  });

  await recalculateProductRating(Review, Product, productId);

  res.status(201).json({ success: true, review });
});

// PUT /api/products/:id/reviews  { rating, title?, comment? } — edits the
// caller's own review (one review per user+product, so no reviewId needed).
const updateReview = asyncHandler(async (req, res) => {
  const errors = validateReviewInput(req.body);
  if (errors.length) {
    res.status(400);
    throw new Error(errors.join(' '));
  }

  const review = await Review.findOne({ product: req.params.id, user: req.user._id });
  if (!review) {
    res.status(404);
    throw new Error("You haven't reviewed this product yet.");
  }

  review.rating = req.body.rating;
  if (req.body.title !== undefined) review.title = req.body.title;
  if (req.body.comment !== undefined) review.comment = req.body.comment;
  await review.save();

  await recalculateProductRating(Review, Product, req.params.id);

  res.json({ success: true, review });
});

// DELETE /api/products/:id/reviews — deletes the caller's own review. This
// is a real delete (not the admin `status: 'hidden'` moderation path) since
// it's the author removing their own content, not a moderation action.
const deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findOneAndDelete({ product: req.params.id, user: req.user._id });
  if (!review) {
    res.status(404);
    throw new Error("You haven't reviewed this product.");
  }

  await recalculateProductRating(Review, Product, req.params.id);

  res.json({ success: true, message: 'Review deleted.' });
});

module.exports = {
  getProductReviews,
  getMyReview,
  createReview,
  updateReview,
  deleteReview,
  hasVerifiedPurchase,
};
