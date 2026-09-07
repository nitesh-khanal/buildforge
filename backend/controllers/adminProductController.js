const Product = require('../models/Product');
const ApiFeatures = require('../utils/apiFeatures');
const asyncHandler = require('../utils/asyncHandler');
const { validateProductInput } = require('../validators/productValidator');
const { buildAdminArchiveFilter } = require('../utils/productArchive');

// GET /api/admin/products — like the public listing, but includes
// out-of-stock items by default and never hides anything behind
// availability filters unless the admin explicitly asks for them.
// Phase 10: also includes archived products by default (`?status=all`,
// the implicit default) so an admin can find and restore them — pass
// `?status=active` or `?status=archived` to narrow.
const listProducts = asyncHandler(async (req, res) => {
  const archiveFilter = buildAdminArchiveFilter(req.query.status);
  const baseQuery = Product.find(archiveFilter);
  const features = new ApiFeatures(baseQuery, req.query).filterBasics().filterSpecs().sort().paginate();
  features.filter = { ...features.filter, ...archiveFilter };

  const [products, total] = await Promise.all([
    features.query,
    Product.countDocuments(features.filter),
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

// POST /api/admin/products
const createProduct = asyncHandler(async (req, res) => {
  const errors = validateProductInput(req.body);
  if (errors.length) {
    res.status(400);
    throw new Error(errors.join(' '));
  }

  const {
    name,
    brand,
    category,
    price,
    description,
    image,
    stock,
    rating,
    isFeatured,
    specifications,
    compatibilityData,
  } = req.body;

  const product = await Product.create({
    name,
    brand,
    category,
    price,
    description,
    image,
    stock: stock ?? 0,
    rating: rating ?? 0,
    isFeatured: Boolean(isFeatured),
    specifications: specifications || {},
    compatibilityData: compatibilityData || {},
  });

  res.status(201).json({ success: true, product });
});

// PUT /api/admin/products/:id — full-ish update; any field omitted is left
// untouched (this is PATCH-flavored on purpose, since re-sending the entire
// specifications/compatibilityData blob every time an admin tweaks the
// price is unnecessary friction).
const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error('Product not found.');
  }

  const errors = validateProductInput(req.body, { partial: true });
  if (errors.length) {
    res.status(400);
    throw new Error(errors.join(' '));
  }

  const editable = [
    'name',
    'brand',
    'category',
    'price',
    'description',
    'image',
    'stock',
    'rating',
    'isFeatured',
  ];
  for (const field of editable) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      product[field] = req.body[field];
    }
  }
  // Merge rather than replace, so an admin can patch a single spec field
  // (e.g. just `{ specifications: { tdp: 105 } }`) without wiping the rest.
  if (req.body.specifications) {
    product.specifications = { ...product.specifications, ...req.body.specifications };
  }
  if (req.body.compatibilityData) {
    product.compatibilityData = { ...product.compatibilityData, ...req.body.compatibilityData };
  }

  await product.save();
  res.json({ success: true, product });
});

// PATCH /api/admin/products/:id/stock — quick restock/adjust without
// touching anything else. Body: { stock: 25 } (absolute) or { adjustBy: 10 }
// (relative, e.g. a new shipment arriving).
const updateStock = asyncHandler(async (req, res) => {
  const { stock, adjustBy } = req.body;
  if (stock === undefined && adjustBy === undefined) {
    res.status(400);
    throw new Error('Provide either "stock" (absolute) or "adjustBy" (relative).');
  }

  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error('Product not found.');
  }

  if (stock !== undefined) {
    if (Number.isNaN(Number(stock)) || Number(stock) < 0) {
      res.status(400);
      throw new Error('stock must be a non-negative number.');
    }
    product.stock = Number(stock);
  } else {
    const newStock = product.stock + Number(adjustBy);
    if (Number.isNaN(newStock) || newStock < 0) {
      res.status(400);
      throw new Error('adjustBy would result in negative stock.');
    }
    product.stock = newStock;
  }

  await product.save();
  res.json({ success: true, product });
});

// DELETE /api/admin/products/:id — Phase 10: soft delete (archive), not a
// hard `deleteOne()` anymore. See BUILD_FORGE_PROGRESS.md's "Known bugs"
// section — a hard delete left existing product links 404ing even though
// historical orders were always safe (item snapshots). An already-archived
// product is a no-op success rather than an error, so a double-click or a
// stale admin tab can't surface a confusing failure.
const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error('Product not found.');
  }
  if (!product.isArchived) {
    product.isArchived = true;
    product.archivedAt = new Date();
    await product.save();
  }
  res.json({ success: true, message: 'Product archived.', product });
});

// PATCH /api/admin/products/:id/restore — undo an archive. A product that
// was never archived is a no-op success, same reasoning as deleteProduct.
const restoreProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error('Product not found.');
  }
  if (product.isArchived) {
    product.isArchived = false;
    product.archivedAt = null;
    await product.save();
  }
  res.json({ success: true, message: 'Product restored.', product });
});

// POST /api/admin/products/:id/image — multipart upload (field name
// "image"), handled by middleware/upload.js. Stores the file under
// /uploads and points the product's `image` field at it.
const uploadProductImage = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error('Product not found.');
  }
  if (!req.file) {
    res.status(400);
    throw new Error('No image file was uploaded (expected multipart field "image").');
  }

  product.image = `/uploads/${req.file.filename}`;
  await product.save();
  res.json({ success: true, product });
});

module.exports = {
  listProducts,
  createProduct,
  updateProduct,
  updateStock,
  deleteProduct,
  restoreProduct,
  uploadProductImage,
};
