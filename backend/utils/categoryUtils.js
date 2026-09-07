// Pure, DB-free helper (Phase 10) that merges three independent sources
// into the shape `GET /api/categories` returns:
//   - `CATEGORIES`   — the fixed 8-slug list from models/Product.js
//   - `countMap`     — { slug: productCount }, from a live aggregate
//   - `categoryDocs` — Category documents (display metadata), which may be
//                       incomplete (a slug with no doc yet, before
//                       ensureDefaultCategories has run) or contain extra
//                       slugs that no longer matter — both are handled
//                       gracefully rather than assumed 1:1.
// Split out of the controller the same way compareUtils/ratingService's pure
// functions were, so it's directly unit-testable with zero mongoose
// dependency. Never mutates its inputs.
function mergeCategoryData(CATEGORIES, countMap, categoryDocs, { activeOnly = false } = {}) {
  const bySlug = new Map(categoryDocs.map((doc) => [doc.slug, doc]));

  const merged = CATEGORIES.map((slug) => {
    const doc = bySlug.get(slug);
    return {
      slug,
      label: doc?.label || slug,
      description: doc?.description || '',
      image: doc?.image || '',
      displayOrder: doc?.displayOrder ?? 0,
      isActive: doc?.isActive ?? true,
      count: countMap[slug] || 0,
    };
  });

  const filtered = activeOnly ? merged.filter((c) => c.isActive) : merged;
  return filtered.sort((a, b) => a.displayOrder - b.displayOrder || a.label.localeCompare(b.label));
}

module.exports = { mergeCategoryData };
