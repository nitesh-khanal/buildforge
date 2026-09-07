const mongoose = require('mongoose');

// Phase 1 foundation for Phase 6/10 (Community reporting + Admin
// moderation queue). One generic model for both reportable target types
// rather than a ReportedBuild + ReportedComment pair, since the moderation
// workflow (list pending, review, resolve) is identical either way.
const REPORT_TARGET_TYPES = ['communityBuild', 'comment'];
const REPORT_STATUSES = ['pending', 'reviewed', 'dismissed', 'actioned'];

const reportSchema = new mongoose.Schema(
  {
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    targetType: { type: String, enum: REPORT_TARGET_TYPES, required: true },
    // Not a `refPath` on purpose — keeping this a plain ObjectId (resolved
    // manually by the Phase 10 admin controller based on targetType) avoids
    // coupling this schema's validity to exactly two hardcoded model names
    // if a third reportable type is ever added.
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },

    reason: { type: String, required: true, trim: true, maxlength: 200 },
    details: { type: String, trim: true, maxlength: 1000, default: '' },

    status: { type: String, enum: REPORT_STATUSES, default: 'pending', index: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    resolutionNotes: { type: String, trim: true, maxlength: 1000, default: '' },
  },
  { timestamps: true }
);

// Admin moderation queue: pending reports, oldest first.
reportSchema.index({ status: 1, createdAt: 1 });
// "All reports against this specific build/comment."
reportSchema.index({ targetType: 1, targetId: 1 });

module.exports = mongoose.model('Report', reportSchema);
module.exports.REPORT_TARGET_TYPES = REPORT_TARGET_TYPES;
module.exports.REPORT_STATUSES = REPORT_STATUSES;
