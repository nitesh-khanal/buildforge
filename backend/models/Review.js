const mongoose = require('mongoose');

// Phase 1 foundation for Phase 2 (Product Reviews).
//
// A review belongs to exactly one user+product pair (the unique index below
// is what "users can edit but not duplicate their review" is built on — the
// Phase 2 controller does an upsert-or-reject against it rather than
// trusting application logic alone to prevent duplicates).
const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },

    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, trim: true, maxlength: 120, default: '' },
    comment: { type: String, trim: true, maxlength: 2000, default: '' },

    // Set by the Phase 2 controller by checking the user's Order history for
    // this product (paymentStatus in Paid/COD) at review-creation time —
    // never trust a client-supplied flag for this.
    verifiedPurchase: { type: Boolean, default: false },

    // Soft-delete-style moderation, matching this project's existing
    // preference for preserving history over hard deletes (see product
    // snapshots on Order/Cart items). Admin "removing" a review sets this to
    // 'hidden' rather than deleting the document, so moderation actions are
    // auditable and reversible.
    status: { type: String, enum: ['visible', 'hidden'], default: 'visible', index: true },
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    moderatedAt: { type: Date, default: null },
    moderationReason: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

// A user can review a given product exactly once (they edit the same
// document afterward rather than creating a second review).
reviewSchema.index({ user: 1, product: 1 }, { unique: true });

// Supports "GET reviews for product, sorted/paginated" and
// "product's most helpful/newest reviews" without a collection scan.
reviewSchema.index({ product: 1, status: 1, createdAt: -1 });
reviewSchema.index({ product: 1, status: 1, rating: -1 });

module.exports = mongoose.model('Review', reviewSchema);
