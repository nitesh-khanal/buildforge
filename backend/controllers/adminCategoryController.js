const Product = require('../models/Product');
const Category = require('../models/Category');
const asyncHandler = require('../utils/asyncHandler');
const { mergeCategoryData } = require('../utils/categoryUtils');
const { DEFAULT_CATEGORY_METADATA } = require('../utils/categoryDefaults');
const { CATEGORIES } = Product;

// GET /api/admin/categories — every fixed category (including inactive
// ones an admin has hidden from the storefront, and including archived
// products in the count so an admin can see the full picture), sorted by
// displayOrder. Unlike the public endpoint, nothing is filtered out here.
const listCategories = asyncHandler(async (req, res) => {
  const [counts, categoryDocs] = await Promise.all([
    Product.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
    Category.find({ slug: { $in: CATEGORIES } }),
  ]);
  const countMap = Object.fromEntries(counts.map((c) => [c._id, c.count]));

  res.json({
    success: true,
    categories: mergeCategoryData(CATEGORIES, countMap, categoryDocs),
  });
});

// PUT /api/admin/categories/:slug — edits display metadata only. `slug`
// itself is never editable (it's the fixed enum value tying this document
// back to every Product in that category, and to the compatibility
// engine's category keys) — see models/Category.js for why the category
// set itself isn't manageable. Upserts, since `ensureDefaultCategories`
// may not have run yet in a freshly-seeded database.
const updateCategory = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  if (!CATEGORIES.includes(slug)) {
    res.status(400);
    throw new Error(`Unknown category slug. Must be one of: ${CATEGORIES.join(', ')}.`);
  }

  const editable = ['label', 'description', 'image', 'displayOrder', 'isActive'];
  const update = {};
  for (const field of editable) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      update[field] = req.body[field];
    }
  }
  if (update.label !== undefined && !String(update.label).trim()) {
    res.status(400);
    throw new Error('Label cannot be empty.');
  }

  // A missing `label` only matters on first-ever insert (server.js's boot
  // hook normally creates this document long before an admin ever edits
  // it) — fall back to the fixed default rather than failing the whole
  // update over a field the admin didn't even touch.
  if (update.label === undefined) {
    const existing = await Category.findOne({ slug }).select('label');
    if (!existing) update.label = DEFAULT_CATEGORY_METADATA[slug]?.label || slug;
  }

  const category = await Category.findOneAndUpdate(
    { slug },
    { $set: { ...update, slug } },
    { new: true, upsert: true, runValidators: true }
  );

  res.json({ success: true, category });
});

// POST /api/admin/categories/:slug/image — Phase 11. Multipart upload
// (field name "image"), handled by middleware/categoryImageUpload.js.
// Upserts the same way updateCategory does, since a freshly-seeded database
// may not have a Category document for this slug yet (ensureDefaultCategories
// runs at boot, but this endpoint shouldn't depend on that having happened).
const uploadCategoryImage = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  if (!CATEGORIES.includes(slug)) {
    res.status(400);
    throw new Error(`Unknown category slug. Must be one of: ${CATEGORIES.join(', ')}.`);
  }
  if (!req.file) {
    res.status(400);
    throw new Error('No image file was uploaded (expected multipart field "image").');
  }

  const existing = await Category.findOne({ slug }).select('label');
  const category = await Category.findOneAndUpdate(
    { slug },
    {
      $set: {
        slug,
        image: `/uploads/${req.file.filename}`,
        ...(existing ? {} : { label: DEFAULT_CATEGORY_METADATA[slug]?.label || slug }),
      },
    },
    { new: true, upsert: true, runValidators: true }
  );

  res.json({ success: true, category });
});

module.exports = { listCategories, updateCategory, uploadCategoryImage };
