const Product = require('../models/Product');
const Order = require('../models/Order');
const asyncHandler = require('../utils/asyncHandler');
const {
  PAIR_CATEGORIES,
  similarProducts,
  frequentlyBoughtWith,
  filterCompatibleForSlot,
  rankCandidates,
  buildHistoryProfile,
  personalizedForUser,
} = require('../services/recommendationService');
const { isEnabled: geminiEnabled, generateBuildAdvice } = require('../services/geminiService');

const REQUIRED_SLOTS = ['cpu', 'motherboard', 'ram', 'gpu', 'storage', 'psu', 'case'];
const ALL_SLOTS = [...REQUIRED_SLOTS, 'cpu-cooler'];

// GET /api/recommendations/similar/:productId — Phase 11: pool is a
// discovery surface (same reasoning as compareController/getRelatedProducts
// in productController), so it now excludes archived products via
// `Product.findActive`. The looked-up-by-id `product` itself is left as a
// direct `findById` — same as `getProductById` — so an existing "similar
// products" widget still renders sensibly even if the page it's on belongs
// to a since-archived product; it just won't recommend other archived ones.
const getSimilar = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.productId);
  if (!product) {
    res.status(404);
    throw new Error('Product not found.');
  }

  const pool = await Product.findActive({ category: product.category, _id: { $ne: product._id } }).limit(40);
  const limit = Math.min(Number(req.query.limit) || 4, 12);
  const products = similarProducts(product, pool, { limit });

  res.json({ success: true, products });
});

// GET /api/recommendations/frequently-bought/:productId — Phase 11: same
// archived-exclusion as getSimilar, applied to each category's candidate
// pool.
const getFrequentlyBought = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.productId);
  if (!product) {
    res.status(404);
    throw new Error('Product not found.');
  }

  let relatedCategories = PAIR_CATEGORIES[product.category] || [];
  // Storage has no modeled pairing — fall back to "other popular storage".
  if (relatedCategories.length === 0) relatedCategories = [product.category];

  const poolsByCategory = {};
  await Promise.all(
    relatedCategories.map(async (category) => {
      const query = { category };
      if (category === product.category) query._id = { $ne: product._id };
      poolsByCategory[category] = await Product.findActive(query).sort('-rating').limit(20);
    })
  );

  const recommendations = frequentlyBoughtWith(product, poolsByCategory);
  res.json({ success: true, productId: product._id, recommendations });
});

// POST /api/recommendations/complete-build
// Body: { components: { cpu: '<id>', ... }, budgetRemaining?: number }
// No login required — same "builder works for guests" rule as /api/builds/check.
//
// Phase 11: the *candidate* pool per empty slot is a discovery surface
// (these are one-click "add to my build" suggestions, so an archived
// product showing up here would be a real purchase-path leak, not just a
// cosmetic one) — now `Product.findActive`. The *already-selected*
// components (`selectedProducts`, keyed by id from the request body) are
// left as a direct `Product.find` by id: they're not being discovered,
// they're being read back to compute compatibility against, same
// "resolves by id regardless of archived status" reasoning as
// `getProductById`/`getBuildCompletions`'s own selected-slot lookups.
const getBuildCompletions = asyncHandler(async (req, res) => {
  const componentIds = req.body.components || {};
  const ids = Object.values(componentIds).filter(Boolean);
  const selectedProducts = await Product.find({ _id: { $in: ids } });
  const byId = new Map(selectedProducts.map((p) => [p._id.toString(), p]));

  const selected = {};
  for (const slot of ALL_SLOTS) {
    const id = componentIds[slot];
    selected[slot] = id ? byId.get(id.toString()) || null : null;
  }

  const emptySlots = REQUIRED_SLOTS.filter((slot) => !selected[slot]);
  const budgetRemaining = req.body.budgetRemaining !== undefined ? Number(req.body.budgetRemaining) : undefined;

  const suggestions = {};
  await Promise.all(
    emptySlots.map(async (slot) => {
      const candidates = await Product.findActive({ category: slot }).limit(40);
      const compatible = filterCompatibleForSlot(slot, candidates, selected);
      suggestions[slot] = rankCandidates(compatible, { limit: 4, budgetRemaining });
    })
  );

  res.json({ success: true, suggestions });
});

// GET /api/recommendations/for-you
// optionalAuth: personalized for logged-in users with order history,
// otherwise falls back to trending/featured products so the section still
// has content for guests and brand-new accounts.
//
// Phase 11: both the guest/new-account fallback and the personalized pool
// are discovery surfaces — now `Product.findActive`. `profile.purchasedProductIds`
// itself is untouched (it's built from real `Order` item snapshots via
// `buildHistoryProfile`, not a live Product query, so an archived product a
// user actually bought in the past is correctly still excluded from being
// re-recommended to them).
const getForYou = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 8, 20);
  const fallback = async () => {
    const products = await Product.findActive({ isFeatured: true }).sort('-rating').limit(limit);
    return res.json({ success: true, personalized: false, products });
  };

  if (!req.user) return fallback();

  const orders = await Order.find({ user: req.user._id })
    .populate('items.product')
    .populate('items.buildComponents.product');
  if (orders.length === 0) return fallback();

  const profile = buildHistoryProfile(orders);
  const pool = await Product.findActive({ _id: { $nin: profile.purchasedProductIds } })
    .sort('-rating')
    .limit(200);
  const products = personalizedForUser(profile, pool, { limit });

  res.json({ success: true, personalized: true, products });
});

// POST /api/recommendations/build-advice
// Body: { components, report } — usually the exact response of
// /api/builds/check, forwarded straight through. Optional Gemini layer;
// returns { enabled: false, advice: null } if GEMINI_API_KEY isn't set, so
// the frontend can just hide the section rather than treat it as an error.
const getBuildAdvice = asyncHandler(async (req, res) => {
  if (!geminiEnabled()) {
    return res.json({ success: true, enabled: false, advice: null });
  }
  const { components, report } = req.body;
  const advice = await generateBuildAdvice({ components, report });
  res.json({ success: true, enabled: true, advice });
});

module.exports = {
  getSimilar,
  getFrequentlyBought,
  getBuildCompletions,
  getForYou,
  getBuildAdvice,
};
