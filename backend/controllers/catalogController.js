const fs = require('fs');
const path = require('path');
const Product = require('../models/Product');
const asyncHandler = require('../utils/asyncHandler');
const { validateCatalog, importOperations } = require('../utils/catalogImport');
const importCatalog = asyncHandler(async (req, res) => {
  const { errors, products } = validateCatalog(req.body.products);
  if (req.body.dryRun !== true && req.body.dryRun !== false) errors.push('dryRun must explicitly be true (preview) or false (import).');
  for (const product of products) {
    if (product.image.startsWith('/uploads/') && !fs.existsSync(path.join(__dirname, '..', product.image))) errors.push(`${product.sku}: upload the photo before importing.`);
  }
  if (errors.length) return res.status(400).json({ success: false, message: errors.join('\n'), errors });
  if (req.body.dryRun) return res.json({ success: true, products, count: products.length });
  // Transaction prevents a partial catalog update if an individual SKU fails.
  const session = await Product.startSession();
  let result;
  try { await session.withTransaction(async () => { result = await Product.bulkWrite(importOperations(products), { session }); }); }
  finally { await session.endSession(); }
  res.json({ success: true, created: result.upsertedCount, updated: result.matchedCount, count: products.length });
});
const uploadCatalogPhoto = asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'Choose a JPEG, PNG or WEBP photo.' });
  res.json({ success: true, image: `/uploads/${req.file.filename}` });
});
module.exports = { importCatalog, uploadCatalogPhoto };
