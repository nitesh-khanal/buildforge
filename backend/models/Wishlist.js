const mongoose = require('mongoose');

// Phase 1 foundation for Phase 2 (Wishlist). Deliberately a join-row per
// user+product — same shape as BuildLike/BuildRating below — rather than an
// array embedded on User or Product, so:
//   - adding/removing one item never means reading+rewriting a whole array
//   - "is this product already wishlisted?" (needed on every product card)
//   - "when was it added?" is a single indexed findOne, not an array scan
//   - the DB itself enforces "no duplicate wishlist entries" via the unique
//     index, instead of the controller having to check-then-insert
const wishlistSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  },
  { timestamps: true }
);

// One user can wishlist a given product at most once.
wishlistSchema.index({ user: 1, product: 1 }, { unique: true });

module.exports = mongoose.model('Wishlist', wishlistSchema);
