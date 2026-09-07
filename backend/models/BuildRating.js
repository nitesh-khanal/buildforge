const mongoose = require('mongoose');

// Phase 1 foundation for Phase 6 (Community Backend). Distinct from
// Review.js (which rates a purchasable Product) — this rates a published
// CommunityBuild as a whole (the parts list/design, not a single component).
const buildRatingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    communityBuild: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CommunityBuild',
      required: true,
      index: true,
    },
    rating: { type: Number, required: true, min: 1, max: 5 },
    review: { type: String, trim: true, maxlength: 1000, default: '' },
  },
  { timestamps: true }
);

// A user can rate a given community build exactly once (edit the same
// document afterward rather than creating a second rating).
buildRatingSchema.index({ user: 1, communityBuild: 1 }, { unique: true });

module.exports = mongoose.model('BuildRating', buildRatingSchema);
