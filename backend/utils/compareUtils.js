// Pure, DB-free helpers for product comparison (Phase 3). Kept separate from
// compareController.js so the actual comparison logic — id-count/category
// validation, spec-key normalization — stays testable without a database,
// matching this project's existing convention (ratingService's
// computeRatingAggregate, utils/apiFeatures.js, utils/inventory.js).
//
// No new model backs this feature (see BUILD_FORGE_PROGRESS.md's Phase 1
// design note): comparison state is a handful of product ids the frontend
// holds client-side, and this endpoint just reads straight from each
// product's existing `specifications`.

const MIN_COMPARE = 2;
const MAX_COMPARE = 4;

// Parses a raw "ids" query param ("id1,id2,id3") into a deduped, trimmed
// array, preserving first-occurrence order — order matters here since it
// becomes the column order in the comparison table.
function parseCompareIds(raw) {
  const seen = new Set();
  const ids = [];
  String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((id) => {
      if (!seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    });
  return ids;
}

// Validates the request shape once the DB lookup is done: right number of
// ids requested, all of them found, and all the same category (comparing a
// CPU to a case isn't meaningful). Returns `{ error: string }` on failure or
// `{ error: null }` on success — never throws, so the controller can turn
// `error` straight into a 400 response.
function validateComparison(ids, products) {
  if (ids.length < MIN_COMPARE || ids.length > MAX_COMPARE) {
    return { error: `You can compare between ${MIN_COMPARE} and ${MAX_COMPARE} products at a time.` };
  }
  if (products.length !== ids.length) {
    return { error: 'One or more products could not be found.' };
  }
  const categories = new Set(products.map((p) => p.category));
  if (categories.size > 1) {
    return { error: 'Products must all be from the same category to compare.' };
  }
  return { error: null };
}

// Builds the union of specification keys across all products, in
// first-seen order, so the frontend can render an aligned table without
// guessing which fields exist on every selected product. A key only counts
// as "present" if at least one product has a non-empty value for it.
function buildSpecKeyUnion(products) {
  const seen = new Set();
  const keys = [];
  products.forEach((product) => {
    const specs = product.specifications || {};
    Object.keys(specs).forEach((key) => {
      const value = specs[key];
      if (value === undefined || value === null || value === '') return;
      if (!seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }
    });
  });
  return keys;
}

module.exports = {
  MIN_COMPARE,
  MAX_COMPARE,
  parseCompareIds,
  validateComparison,
  buildSpecKeyUnion,
};
