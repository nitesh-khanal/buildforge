const BuildRating = require('../models/BuildRating');
const CommunityBuild = require('../models/CommunityBuild');
const asyncHandler = require('../utils/asyncHandler');
const { validateBuildRatingInput } = require('../validators/communityValidator');
const { recalculateBuildRating } = require('../services/ratingService');
const { canView } = require('./communityBuildController');

// GET /api/community/builds/:id/ratings?page=&limit= — the individual
// rating/review rows (distinct from the denormalized averageRating/
// ratingCount already on the build document, same relationship the
// Review list has to Product.rating).
const getRatings = asyncHandler(async (req, res) => {
  const build = await CommunityBuild.findById(req.params.id);
  if (!build || !canView(build, req.user)) {
    res.status(404);
    throw new Error('Community build not found.');
  }

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const filter = { communityBuild: build._id };

  const [ratings, total] = await Promise.all([
    BuildRating.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('user', 'name'),
    BuildRating.countDocuments(filter),
  ]);

  res.json({ success: true, ratings, total, page, pages: Math.ceil(total / limit) || 1 });
});

// POST /api/community/builds/:id/rating  { rating, review? } — a user can
// rate a given build exactly once (unique index on BuildRating), so this
// upserts rather than always creating.
const rateBuild = asyncHandler(async (req, res) => {
  const build = await CommunityBuild.findById(req.params.id);
  if (!build || !canView(build, req.user)) {
    res.status(404);
    throw new Error('Community build not found.');
  }
  if (build.user.toString() === req.user._id.toString()) {
    res.status(400);
    throw new Error('You cannot rate your own build.');
  }

  const errors = validateBuildRatingInput(req.body);
  if (errors.length) {
    res.status(400);
    throw new Error(errors.join(' '));
  }

  const rating = await BuildRating.findOneAndUpdate(
    { user: req.user._id, communityBuild: build._id },
    { rating: req.body.rating, review: req.body.review || '' },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  );

  const { averageRating, ratingCount } = await recalculateBuildRating(BuildRating, CommunityBuild, build._id);

  res.json({ success: true, rating, averageRating, ratingCount });
});

// DELETE /api/community/builds/:id/rating — removes the caller's own rating.
const deleteRating = asyncHandler(async (req, res) => {
  const rating = await BuildRating.findOneAndDelete({
    user: req.user._id,
    communityBuild: req.params.id,
  });
  if (!rating) {
    res.status(404);
    throw new Error("You haven't rated this build.");
  }

  const { averageRating, ratingCount } = await recalculateBuildRating(
    BuildRating,
    CommunityBuild,
    req.params.id
  );

  res.json({ success: true, message: 'Rating removed.', averageRating, ratingCount });
});

module.exports = { getRatings, rateBuild, deleteRating };
