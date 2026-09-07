const mongoose = require('mongoose');
const Build = require('./Build');

// Phase 1 foundation for Phase 6/7 (Community Backend/Frontend) and Phase 8
// (Copy Build). Reuses Build.js's component sub-schema and enums instead of
// re-declaring the 8 PC-builder slots a second time — see Build.js, which
// exports `componentsSchema`, `CATEGORY_KEYS`, and `COMPATIBILITY_STATUSES`
// specifically so this file (and nothing else) can pull them in.
//
// `category` here is a free-form "use case" tag (gaming/budget/workstation)
// for browsing/filtering the community feed — unrelated to, and not to be
// confused with, Product.CATEGORIES (cpu/gpu/motherboard/...).
const BUILD_USE_CASES = ['gaming', 'workstation', 'budget', 'high-end', 'office', 'custom'];
const VISIBILITY_OPTIONS = ['public', 'unlisted', 'private'];

const communityBuildSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    title: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },

    // Optional provenance link back to the user's private saved Build this
    // was published from — nullable because the source Build can later be
    // edited/deleted by its owner without that affecting the published post
    // (per Phase 7's "the original community build must never be modified"
    // requirement running in the *other* direction too: publishing snapshots
    // away from the live Build, it doesn't stay linked/mutable).
    sourceBuild: { type: mongoose.Schema.Types.ObjectId, ref: 'Build', default: null },

    // Snapshot of the build at publish time — same componentsSchema Build.js
    // uses, so "8 nullable Product-ref slots" is defined in exactly one
    // place in the codebase.
    components: { type: Build.componentsSchema, default: () => ({}) },
    totalPrice: { type: Number, default: 0, min: 0 },
    compatibilityStatus: {
      type: String,
      enum: Build.COMPATIBILITY_STATUSES,
      default: 'error',
    },

    image: { type: String, default: '' },
    category: { type: String, enum: BUILD_USE_CASES, default: 'custom' },
    tags: [{ type: String, trim: true, lowercase: true }],

    // User's own privacy choice for the post.
    visibility: { type: String, enum: VISIBILITY_OPTIONS, default: 'public' },
    // Admin moderation state — independent of the user's visibility choice;
    // matches the soft-delete-style `status` pattern used on Review/Comment
    // so a takedown is auditable rather than a hard delete.
    status: { type: String, enum: ['visible', 'hidden'], default: 'visible', index: true },
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    moderatedAt: { type: Date, default: null },
    moderationReason: { type: String, trim: true, default: '' },

    // Denormalized counters for feed sorting (trending/popular/most-copied)
    // without a live aggregation on every request. Source of truth for likes
    // is BuildLike, for comments is Comment, for ratings is BuildRating —
    // the Phase 6 controller keeps these in sync on each create/delete
    // rather than this document being authoritative on its own.
    likesCount: { type: Number, default: 0, min: 0 },
    commentsCount: { type: Number, default: 0, min: 0 },
    viewsCount: { type: Number, default: 0, min: 0 },
    copiesCount: { type: Number, default: 0, min: 0 },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

// Feed queries: public+visible builds, newest/most-liked/most-viewed first.
communityBuildSchema.index({ visibility: 1, status: 1, createdAt: -1 });
communityBuildSchema.index({ visibility: 1, status: 1, likesCount: -1 });
communityBuildSchema.index({ visibility: 1, status: 1, viewsCount: -1 });
communityBuildSchema.index({ visibility: 1, status: 1, averageRating: -1 });
// "My community builds" page.
communityBuildSchema.index({ user: 1, createdAt: -1 });
// Search/filter by title, description, tags, and use-case category.
communityBuildSchema.index({ title: 'text', description: 'text', tags: 'text' });
communityBuildSchema.index({ category: 1 });

module.exports = mongoose.model('CommunityBuild', communityBuildSchema);
module.exports.BUILD_USE_CASES = BUILD_USE_CASES;
module.exports.VISIBILITY_OPTIONS = VISIBILITY_OPTIONS;
