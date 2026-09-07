const Product = require('../models/Product');
const ApiFeatures = require('../utils/apiFeatures');
const asyncHandler = require('../utils/asyncHandler');
const {
  checkCpuMotherboard,
  checkRamMotherboard,
  checkMotherboardCase,
  checkGpuCase,
  checkCoolerSocket,
  checkCoolerCase,
} = require('../services/compatibilityService');

// GET /api/products
// Supports: ?category=&brand=&minPrice=&maxPrice=&rating=&availability=&search=
//           &sort=&page=&limit=&spec.socket=AM5 etc.
const getProducts = asyncHandler(async (req, res) => {
  // Phase 10: browsing surfaces never show archived products — see
  // Product.findActive / utils/productArchive.js.
  const baseQuery = Product.findActive();
  const features = new ApiFeatures(baseQuery, req.query)
    .filterBasics()
    .filterSpecs()
    .sort()
    .paginate();

  const [products, total] = await Promise.all([
    features.query,
    Product.countDocuments({ ...features.filter, isArchived: { $ne: true } }),
  ]);

  res.json({
    success: true,
    count: products.length,
    total,
    page: features.pagination.page,
    pages: Math.ceil(total / features.pagination.limit),
    products,
  });
});

// GET /api/products/:id — Phase 10: still resolves for an archived product
// (rather than 404ing) so existing links/bookmarks keep working; the
// response's `isArchived` flag is what the frontend uses to show a
// "no longer available" state and disable add-to-cart, instead of a broken
// page. Only browsing/discovery surfaces (listing, featured, search,
// related, works-with, category counts) actually hide archived products.
const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error('Product not found.');
  }
  res.json({ success: true, product });
});

// GET /api/products/:id/related — same category, excluding itself
const getRelatedProducts = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error('Product not found.');
  }
  const related = await Product.findActive({
    category: product.category,
    _id: { $ne: product._id },
  }).limit(4);
  res.json({ success: true, products: related });
});

// GET /api/products/featured
const getFeaturedProducts = asyncHandler(async (req, res) => {
  const products = await Product.findActive({ isFeatured: true }).limit(8);
  res.json({ success: true, products });
});

// GET /api/products/search/suggestions?q=RTX
const getSearchSuggestions = asyncHandler(async (req, res) => {
  const q = req.query.q;
  if (!q || q.trim().length < 2) {
    return res.json({ success: true, suggestions: [] });
  }
  const re = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const suggestions = await Product.findActive({
    $or: [{ name: re }, { brand: re }],
  })
    .select('name brand category price image')
    .limit(8);
  res.json({ success: true, suggestions });
});

// GET /api/categories — Phase 10: now returns each category's admin-managed
// display metadata (label/description/image/displayOrder) alongside its
// live product count, sorted by displayOrder, and drops any category an
// admin has hidden from the storefront (`isActive: false`) — see
// utils/categoryUtils.js / models/Category.js. The response shape is
// backward compatible (`slug`/`count` are unchanged), just with more fields
// alongside them.
const getCategories = asyncHandler(async (req, res) => {
  const { CATEGORIES } = require('../models/Product');
  const Category = require('../models/Category');
  const { mergeCategoryData } = require('../utils/categoryUtils');

  const [counts, categoryDocs] = await Promise.all([
    Product.aggregate([
      { $match: { isArchived: { $ne: true } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]),
    Category.find({ slug: { $in: CATEGORIES } }),
  ]);
  const countMap = Object.fromEntries(counts.map((c) => [c._id, c.count]));

  res.json({
    success: true,
    categories: mergeCategoryData(CATEGORIES, countMap, categoryDocs, { activeOnly: true }),
  });
});

// GET /api/products/:id/works-with — "Works With" section on product detail
// pages (spec section 44). Reuses the exact same pairwise checks as the PC
// builder so compatibility logic only lives in one place.
const getWorksWith = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error('Product not found.');
  }

  const isCompatible = (issues) => issues.length === 0;
  const result = {};

  if (product.category === 'cpu') {
    const motherboards = await Product.findActive({ category: 'motherboard' }).limit(50);
    result.compatibleMotherboards = motherboards.filter((m) => isCompatible(checkCpuMotherboard(product, m)));

    const coolers = await Product.findActive({ category: 'cpu-cooler' }).limit(50);
    result.compatibleCpuCoolers = coolers.filter((c) => isCompatible(checkCoolerSocket(c, product)));
  }

  if (product.category === 'motherboard') {
    const cpus = await Product.findActive({ category: 'cpu' }).limit(50);
    result.compatibleCpus = cpus.filter((c) => isCompatible(checkCpuMotherboard(c, product)));

    const ramKits = await Product.findActive({ category: 'ram' }).limit(50);
    result.compatibleRam = ramKits.filter((r) => isCompatible(checkRamMotherboard(r, product)));

    const cases = await Product.findActive({ category: 'case' }).limit(50);
    result.compatibleCases = cases.filter((c) => isCompatible(checkMotherboardCase(product, c)));
  }

  if (product.category === 'ram') {
    const motherboards = await Product.findActive({ category: 'motherboard' }).limit(50);
    result.compatibleMotherboards = motherboards.filter((m) => isCompatible(checkRamMotherboard(product, m)));
  }

  if (product.category === 'gpu') {
    const cases = await Product.findActive({ category: 'case' }).limit(50);
    result.compatibleCases = cases.filter((c) => isCompatible(checkGpuCase(product, c)));

    const recommendedWattage = product.compatibilityData?.recommendedPSU || 0;
    result.recommendedPsus = await Product.findActive({
      category: 'psu',
      'compatibilityData.wattage': { $gte: recommendedWattage },
    }).limit(10);
  }

  if (product.category === 'case') {
    const motherboards = await Product.findActive({ category: 'motherboard' }).limit(50);
    result.compatibleMotherboards = motherboards.filter((m) => isCompatible(checkMotherboardCase(m, product)));

    const gpus = await Product.findActive({ category: 'gpu' }).limit(50);
    result.compatibleGpus = gpus.filter((g) => isCompatible(checkGpuCase(g, product)));

    const coolers = await Product.findActive({ category: 'cpu-cooler' }).limit(50);
    result.compatibleCpuCoolers = coolers.filter((c) => isCompatible(checkCoolerCase(c, product)));
  }

  if (product.category === 'cpu-cooler') {
    const cpus = await Product.findActive({ category: 'cpu' }).limit(50);
    result.compatibleCpus = cpus.filter((c) => isCompatible(checkCoolerSocket(product, c)));

    const cases = await Product.findActive({ category: 'case' }).limit(50);
    result.compatibleCases = cases.filter((c) => isCompatible(checkCoolerCase(product, c)));
  }

  if (product.category === 'psu') {
    const gpus = await Product.findActive({ category: 'gpu' }).limit(50);
    result.recommendedForGpus = gpus.filter(
      (g) => (product.compatibilityData?.wattage || 0) >= (g.compatibilityData?.recommendedPSU || 0)
    );
  }

  res.json({ success: true, category: product.category, worksWith: result });
});

module.exports = {
  getProducts,
  getProductById,
  getRelatedProducts,
  getFeaturedProducts,
  getSearchSuggestions,
  getCategories,
  getWorksWith,
};
