// Default display metadata for the 8 fixed categories (Phase 10 — see
// models/Category.js for why this list itself is fixed). Labels mirror
// `frontend/src/utils/specs.js`'s existing `CATEGORY_LABELS` so the
// first-ever admin view of `/admin/categories` shows the same names
// customers already see today, before any admin edit happens.
const DEFAULT_CATEGORY_METADATA = {
  cpu: { label: 'CPU', displayOrder: 1 },
  gpu: { label: 'GPU', displayOrder: 2 },
  motherboard: { label: 'Motherboard', displayOrder: 3 },
  ram: { label: 'RAM', displayOrder: 4 },
  storage: { label: 'Storage', displayOrder: 5 },
  psu: { label: 'PSU', displayOrder: 6 },
  case: { label: 'Case', displayOrder: 7 },
  'cpu-cooler': { label: 'CPU Cooler', displayOrder: 8 },
};

// Idempotent: creates a Category document for any of Product.CATEGORIES
// that doesn't have one yet, using the defaults above. Never overwrites an
// existing document — an admin's edits are never silently reverted by a
// server restart. Safe to call on every boot (see server.js).
async function ensureDefaultCategories(CategoryModel, categorySlugs) {
  const existing = await CategoryModel.find({ slug: { $in: categorySlugs } }).select('slug');
  const existingSlugs = new Set(existing.map((c) => c.slug));
  const missing = categorySlugs.filter((slug) => !existingSlugs.has(slug));
  if (missing.length === 0) return [];

  const docs = missing.map((slug) => ({
    slug,
    ...(DEFAULT_CATEGORY_METADATA[slug] || { label: slug }),
  }));
  return CategoryModel.insertMany(docs);
}

module.exports = { DEFAULT_CATEGORY_METADATA, ensureDefaultCategories };
