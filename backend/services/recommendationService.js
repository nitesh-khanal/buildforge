/**
 * Rule-based recommendation engine (Phase 4).
 *
 * Like compatibilityService, every function here is a pure function of the
 * data passed in — no DB or network calls — so it's cheap to unit test and
 * safe to reuse across every "recommendations" surface (product page,
 * builder, homepage). Controllers are responsible for fetching candidate
 * pools from MongoDB and handing them to these functions.
 */

const {
  checkCpuMotherboard,
  checkRamMotherboard,
  checkMotherboardCase,
  checkGpuCase,
  checkCoolerSocket,
  checkCoolerCase,
  checkPowerBudget,
} = require('./compatibilityService');

// Which categories are worth showing as "frequently bought with X", based on
// the same pairwise relationships the compatibility engine already knows
// about. Storage has no modeled compatibility constraints (any M.2/SATA
// drive works with any board in this dataset), so it's intentionally
// omitted — a storage product's "frequently bought with" falls back to
// other popular storage instead (handled by the controller).
const PAIR_CATEGORIES = {
  cpu: ['motherboard', 'cpu-cooler'],
  motherboard: ['cpu', 'ram', 'case'],
  ram: ['motherboard'],
  gpu: ['case', 'psu'],
  case: ['motherboard', 'gpu', 'psu', 'cpu-cooler'],
  psu: ['gpu', 'case'],
  'cpu-cooler': ['cpu', 'case'],
  storage: [],
};

// Per-category compatibility filters used when suggesting a product to fill
// an empty build slot — each checks the candidate against whatever's
// already selected, reusing the exact same pairwise checks as the builder
// so a suggestion can never itself introduce a compatibility error.
const CATEGORY_COMPAT_CHECKS = {
  cpu: (candidate, selected) => [
    ...checkCpuMotherboard(candidate, selected.motherboard),
    ...checkCoolerSocket(selected['cpu-cooler'], candidate),
  ],
  motherboard: (candidate, selected) => [
    ...checkCpuMotherboard(selected.cpu, candidate),
    ...checkRamMotherboard(selected.ram, candidate),
    ...checkMotherboardCase(candidate, selected.case),
  ],
  ram: (candidate, selected) => [...checkRamMotherboard(candidate, selected.motherboard)],
  gpu: (candidate, selected) => [...checkGpuCase(candidate, selected.case)],
  case: (candidate, selected) => [
    ...checkMotherboardCase(selected.motherboard, candidate),
    ...checkGpuCase(selected.gpu, candidate),
    ...checkCoolerCase(selected['cpu-cooler'], candidate),
  ],
  'cpu-cooler': (candidate, selected) => [
    ...checkCoolerSocket(candidate, selected.cpu),
    ...checkCoolerCase(candidate, selected.case),
  ],
  psu: (candidate, selected) => checkPowerBudget({ ...selected, psu: candidate }).issues,
  storage: () => [], // no modeled constraints
};

function rankByRatingThenFeatured(products) {
  return [...products].sort(
    (a, b) => Number(b.isFeatured) - Number(a.isFeatured) || (b.rating || 0) - (a.rating || 0) || a.price - b.price
  );
}

// Same-category products within a price band of the given product, ranked
// by rating/featured status. Best-effort: if the caller's candidate pool is
// small, this may return fewer than `limit` — the controller is responsible
// for fetching a wide-enough pool.
function similarProducts(product, pool, { limit = 4, priceBandPct = 0.35 } = {}) {
  const min = product.price * (1 - priceBandPct);
  const max = product.price * (1 + priceBandPct);
  const productId = product._id?.toString();
  const candidates = pool.filter((p) => p._id?.toString() !== productId && p.price >= min && p.price <= max);
  return rankByRatingThenFeatured(candidates).slice(0, limit);
}

// Given a product and pools of candidates for each related category, picks
// the top few from each — e.g. for a CPU, top motherboards + top coolers.
function frequentlyBoughtWith(product, poolsByCategory, { limitPerCategory = 2 } = {}) {
  const relatedCategories = PAIR_CATEGORIES[product.category] || [];
  const result = {};
  for (const category of relatedCategories) {
    const pool = poolsByCategory[category] || [];
    result[category] = rankByRatingThenFeatured(pool).slice(0, limitPerCategory);
  }
  return result;
}

// Filters a candidate pool for a given empty slot down to only the products
// that would introduce zero compatibility *errors* against what's already
// selected. Warnings are kept (and penalized later in rankCandidates) since
// they don't block a build, per the compatibility engine's own rules.
function filterCompatibleForSlot(category, candidates, selectedComponents = {}) {
  const checkFn = CATEGORY_COMPAT_CHECKS[category];
  if (!checkFn) return candidates.map((product) => ({ product, issues: [] }));
  return candidates
    .map((product) => ({ product, issues: checkFn(product, selectedComponents) }))
    .filter(({ issues }) => !issues.some((i) => i.level === 'error'));
}

// Ranks already-filtered { product, issues } entries. Rating and "featured"
// status push a product up; compatibility warnings and being over budget
// push it down (but never exclude it — a slightly-over-budget top pick is
// still worth showing).
function rankCandidates(entries, { limit = 4, budgetRemaining } = {}) {
  const scored = entries.map(({ product, issues = [] }) => {
    const warningCount = issues.filter((i) => i.level === 'warning').length;
    let score = (product.rating || 0) * 10 + (product.isFeatured ? 5 : 0) - warningCount * 3;
    if (typeof budgetRemaining === 'number' && product.price > budgetRemaining) {
      score -= 50;
    }
    return { product, issues, score };
  });
  scored.sort((a, b) => b.score - a.score || a.product.price - b.product.price);
  return scored.slice(0, limit).map(({ product, issues }) => ({ product, issues }));
}

// Turns a list of *populated* orders (items.product and
// items.buildComponents.product resolved to full Product docs) into a
// simple category/brand affinity profile for personalization.
function buildHistoryProfile(orders) {
  const categoryCounts = {};
  const brandCounts = {};
  const purchasedProductIds = new Set();

  const tally = (category, brand, productId) => {
    if (category) categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    if (brand) brandCounts[brand] = (brandCounts[brand] || 0) + 1;
    if (productId) purchasedProductIds.add(productId.toString());
  };

  for (const order of orders) {
    for (const item of order.items) {
      if (item.isCustomBuild) {
        for (const comp of item.buildComponents || []) {
          const brand = comp.product?.brand;
          const productId = comp.product?._id || comp.product;
          tally(comp.category, brand, productId);
        }
      } else if (item.product) {
        const category = item.product?.category;
        const brand = item.product?.brand;
        const productId = item.product?._id || item.product;
        tally(category, brand, productId);
      }
    }
  }

  return { categoryCounts, brandCounts, purchasedProductIds: [...purchasedProductIds] };
}

// Ranks a candidate pool for a specific user using their purchase-history
// profile (categories/brands they've bought before, weighted higher) plus
// general rating/featured signal as a tiebreaker. Already-purchased
// products should be excluded from `candidatePool` by the caller.
function personalizedForUser(profile, candidatePool, { limit = 8 } = {}) {
  const { categoryCounts = {}, brandCounts = {} } = profile || {};
  const scored = candidatePool.map((product) => {
    const categoryScore = (categoryCounts[product.category] || 0) * 5;
    const brandScore = (brandCounts[product.brand] || 0) * 3;
    const ratingScore = (product.rating || 0) * 2;
    const featuredScore = product.isFeatured ? 2 : 0;
    return { product, score: categoryScore + brandScore + ratingScore + featuredScore };
  });
  scored.sort((a, b) => b.score - a.score || (b.product.rating || 0) - (a.product.rating || 0));
  return scored.slice(0, limit).map((s) => s.product);
}

module.exports = {
  PAIR_CATEGORIES,
  similarProducts,
  frequentlyBoughtWith,
  filterCompatibleForSlot,
  rankCandidates,
  buildHistoryProfile,
  personalizedForUser,
};
