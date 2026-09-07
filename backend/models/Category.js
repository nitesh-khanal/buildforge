const mongoose = require('mongoose');
const { CATEGORIES } = require('./Product');

// Phase 10 — Category Management. Deliberately *not* a free-form collection
// an admin can add/remove rows from: the 8 slugs in `Product.CATEGORIES` are
// structurally load-bearing everywhere else in this codebase — the PC
// builder's 8 fixed slots (`Build.CATEGORY_KEYS`), every pairwise check in
// `compatibilityService.js`, and the enum on `Product.category` itself all
// assume exactly these 8 values. Adding a 9th category here wouldn't do
// anything useful (nothing else in the app knows what to do with it), and
// removing one would orphan every existing product in it. So "category
// management" in this phase means managing each fixed category's *display*
// metadata (the label/description/image/order/visibility a customer sees),
// not the set of categories itself — see adminCategoryController.js.
const categorySchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, enum: CATEGORIES },
    label: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    image: { type: String, default: '' },
    displayOrder: { type: Number, default: 0, index: true },
    // Hides the category from the storefront's category nav/home tiles
    // without touching its products or the underlying enum — a "pause this
    // category tile" toggle, same spirit as Coupon.isActive.
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Category', categorySchema);
