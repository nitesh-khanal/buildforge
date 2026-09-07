const mongoose = require('mongoose');

const CATEGORIES = [
  'cpu',
  'gpu',
  'motherboard',
  'ram',
  'storage',
  'psu',
  'case',
  'cpu-cooler',
];

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    brand: { type: String, required: true, trim: true, index: true },
    category: {
      type: String,
      required: true,
      enum: CATEGORIES,
      index: true,
    },
    price: { type: Number, required: true, min: 0, index: true },
    description: { type: String, default: '' },
    image: { type: String, default: '/uploads/placeholder.png' },
    stock: { type: Number, required: true, min: 0, default: 0 },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    isFeatured: { type: Boolean, default: false },

    // Denormalized review aggregates (Phase 2 — Product Reviews). `rating`
    // above remains the single source of truth for "average rating" used
    // everywhere else in the app (cards, sort, recommendations); these two
    // fields just cache the supporting numbers so the product page can show
    // a count + star-distribution bar without a live aggregation query on
    // every request. Both stay at their defaults (0 / all-zero) until the
    // Phase 2 review controller starts recalculating them on
    // create/update/delete of a Review — nothing reads or writes these yet.
    numReviews: { type: Number, default: 0, min: 0 },
    // Star counts keyed "1".."5" (Mongoose Maps always have string keys).
    // A fresh Map per document, not a shared literal — each call to the
    // default function returns a brand-new Map instance.
    ratingDistribution: {
      type: Map,
      of: Number,
      default: () => new Map([['1', 0], ['2', 0], ['3', 0], ['4', 0], ['5', 0]]),
    },

    // Flexible per-category spec fields, e.g. socket, cores, wattage, vram...
    specifications: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Data used by the compatibility engine, e.g.
    // { socket: 'AM5', formFactor: 'ATX', wattage: 650, tdp: 105, ... }
    compatibilityData: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Soft delete/archive (Phase 10 — Admin Improvements). Replaces the
    // previous hard `deleteOne()` in adminProductController, which left
    // existing product-page links/bookmarks 404ing after a delete even
    // though historical orders were always safe (they store snapshots, not
    // live references — see BUILD_FORGE_PROGRESS.md's architectural notes).
    // An archived product simply drops out of every *browsing* surface
    // (listing, featured, search suggestions, related, works-with, category
    // counts) while its detail page still resolves — see
    // `utils/productArchive.js` and `productController.getProductById`.
    isArchived: { type: Boolean, default: false, index: true },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

productSchema.index({ name: 'text', brand: 'text', 'specifications.model': 'text' });

productSchema.virtual('stockStatus').get(function () {
  if (this.stock <= 0) return 'out-of-stock';
  if (this.stock <= 3) return 'low-stock';
  return 'in-stock';
});

productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

// Phase 10: the one place every *browsing* surface (never admin, never a
// direct-by-id lookup like getProductById/cart/order re-hydration) should
// go through instead of `Product.find(...)` directly, so "hide archived
// products from browsing" can't accidentally be forgotten on a future new
// endpoint the way it easily could be if every controller repeated its own
// `{ isArchived: { $ne: true } }` clause inline.
productSchema.statics.findActive = function (filter = {}) {
  return this.find({ ...filter, isArchived: { $ne: true } });
};

module.exports = mongoose.model('Product', productSchema);
module.exports.CATEGORIES = CATEGORIES;
