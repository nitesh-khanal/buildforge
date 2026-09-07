const mongoose = require('mongoose');

// Phase 1 foundation for Phase 6 (Community Backend).
const buildLikeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    communityBuild: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CommunityBuild',
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

// A user can like a given community build at most once — also what makes
// "like" a toggle (create-if-absent / delete-if-present) rather than
// something the controller needs to check-then-insert.
buildLikeSchema.index({ user: 1, communityBuild: 1 }, { unique: true });

module.exports = mongoose.model('BuildLike', buildLikeSchema);
