// Rating aggregation for Reviews -> Product. `computeRatingAggregate` is
// pure (no DB), so it's covered directly by a fast isolated Jest suite —
// same convention as compatibilityService/recommendationService.
// `recalculateProductRating` takes the Review/Product models as parameters
// rather than require()-ing them at the top of the file, matching
// utils/inventory.js's `restockOrderItems(Product, items)` — keeps this
// file loadable (and its pure function testable) with zero DB/mongoose
// dependency.

// Given the ratings of a product's *visible* reviews, compute the numbers
// `Product.rating`/`numReviews`/`ratingDistribution` should hold. `reviews`
// is an array of numbers or {rating} objects (either works, so callers can
// pass raw Review docs or plain numbers in tests).
function computeRatingAggregate(reviews) {
  const ratings = reviews.map((r) => (typeof r === 'number' ? r : r.rating));

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of ratings) {
    const bucket = Math.round(r);
    if (distribution[bucket] !== undefined) distribution[bucket] += 1;
  }

  const numReviews = ratings.length;
  const rating =
    numReviews === 0
      ? 0
      : Math.round((ratings.reduce((sum, r) => sum + r, 0) / numReviews) * 10) / 10;

  return { rating, numReviews, ratingDistribution: distribution };
}

// Re-reads every *visible* review for a product and writes the recomputed
// aggregate back onto the Product document. Called after any create/update/
// delete/moderate of a Review so `rating`/`numReviews`/`ratingDistribution`
// never drift from the underlying review set. `status: 'hidden'` reviews
// (admin-moderated) are excluded, same as the public review list.
async function recalculateProductRating(Review, Product, productId) {
  const reviews = await Review.find({ product: productId, status: 'visible' }).select('rating');
  const { rating, numReviews, ratingDistribution } = computeRatingAggregate(reviews);

  await Product.findByIdAndUpdate(productId, {
    rating,
    numReviews,
    ratingDistribution: new Map(Object.entries(ratingDistribution)),
  });

  return { rating, numReviews, ratingDistribution };
}

// Phase 6 counterpart to recalculateProductRating, for BuildRating ->
// CommunityBuild instead of Review -> Product. Reuses the same pure
// computeRatingAggregate — the aggregation math doesn't care what's being
// rated — and takes BuildRating/CommunityBuild as parameters for the same
// reason recalculateProductRating takes Review/Product: keeps this file
// loadable, and computeRatingAggregate testable, with zero mongoose
// dependency. CommunityBuild has no per-star distribution field (unlike
// Product), so only `rating`/`numReviews` from the aggregate are used —
// mapped onto CommunityBuild's `averageRating`/`ratingCount` names.
async function recalculateBuildRating(BuildRating, CommunityBuild, communityBuildId) {
  const ratings = await BuildRating.find({ communityBuild: communityBuildId }).select('rating');
  const { rating, numReviews } = computeRatingAggregate(ratings);

  await CommunityBuild.findByIdAndUpdate(communityBuildId, {
    averageRating: rating,
    ratingCount: numReviews,
  });

  return { averageRating: rating, ratingCount: numReviews };
}

module.exports = { computeRatingAggregate, recalculateProductRating, recalculateBuildRating };
