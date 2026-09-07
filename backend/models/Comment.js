const mongoose = require('mongoose');

// Phase 1 foundation for Phase 6 (Community Backend).
const commentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    communityBuild: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CommunityBuild',
      required: true,
      index: true,
    },
    text: { type: String, required: true, trim: true, maxlength: 1000 },
    isEdited: { type: Boolean, default: false },

    // Same soft-delete-style moderation pattern as Review/CommunityBuild —
    // covers both a user deleting their own comment and an admin removing
    // someone else's, while keeping an auditable record either way.
    status: { type: String, enum: ['visible', 'hidden'], default: 'visible', index: true },
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    moderatedAt: { type: Date, default: null },
    moderationReason: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

// "Comments for this build, oldest/newest first, paginated."
commentSchema.index({ communityBuild: 1, status: 1, createdAt: 1 });

module.exports = mongoose.model('Comment', commentSchema);
