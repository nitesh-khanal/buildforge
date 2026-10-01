const { CATEGORIES } = require('../models/Product');
const { validateProductInput } = require('../validators/productValidator');
const REQUIRED_COMPATIBILITY = {
  cpu: ['socket', 'tdp'], gpu: ['length', 'tdp', 'recommendedPSU'],
  motherboard: ['socket', 'ramType', 'maxRam', 'formFactor'], ram: ['type', 'capacity'],
  storage: [], psu: ['wattage', 'formFactor'],
  case: ['supportedMotherboardSizes', 'gpuMaxLength', 'cpuCoolerMaxHeight', 'psuFormFactor'],
  'cpu-cooler': ['supportedSockets', 'height', 'tdpRating'],
};
function plainObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function safeObject(value) {
  if (!plainObject(value)) return false;
  return Object.entries(value).every(([key, entry]) => !key.startsWith('$') && !key.includes('.') && !['__proto__', 'constructor', 'prototype'].includes(key) &&
    (plainObject(entry) ? safeObject(entry) : Array.isArray(entry) ? entry.every((item) => typeof item === 'string' || (typeof item === 'number' && Number.isFinite(item))) : (['string', 'boolean'].includes(typeof entry) || (typeof entry === 'number' && Number.isFinite(entry)))));
}
function httpsUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
}
function validateCatalog(rows) {
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 100) return { errors: ['Import must contain 1–100 products.'], products: [] };
  const errors = [];
  const skus = new Set();
  const products = rows.map((row, index) => {
    const prefix = `Row ${index + 1}`;
    if (!plainObject(row)) { errors.push(`${prefix}: expected a product object.`); return null; }
    const sku = typeof row.sku === 'string' ? row.sku.trim().toUpperCase() : '';
    if (!/^[A-Z0-9][A-Z0-9._-]{1,79}$/.test(sku)) errors.push(`${prefix}: use a unique SKU (2–80 letters, numbers, dots, dashes or underscores).`);
    if (skus.has(sku)) errors.push(`${prefix}: duplicate SKU ${sku}.`);
    skus.add(sku);
    for (const field of ['name', 'brand', 'category', 'description', 'mpn']) {
      if (row[field] !== undefined && (typeof row[field] !== 'string' || row[field].length > 5000)) errors.push(`${prefix}: ${field} must be text.`);
    }
    errors.push(...validateProductInput(row).map((error) => `${prefix}: ${error}`));
    if (typeof row.price !== 'number' || !Number.isFinite(row.price) || row.price < 0) errors.push(`${prefix}: price must be a finite NPR number.`);
    if (!Number.isSafeInteger(row.stock) || row.stock < 0) errors.push(`${prefix}: stock must be a non-negative integer.`);
    if (!safeObject(row.specifications || {})) errors.push(`${prefix}: specifications must be a plain object without operators.`);
    if (!safeObject(row.compatibilityData || {})) errors.push(`${prefix}: compatibilityData must be a plain object without operators.`);
    const image = typeof row.image === 'string' ? row.image : '';
    const localImage = /^\/uploads\/[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp)$/i.test(image);
    if (!localImage && !httpsUrl(image)) errors.push(`${prefix}: supply an uploaded image or an HTTPS image URL.`);
    if (image.includes('placeholder') || image.includes('REPLACE') || image.includes('images.icecat.biz')) errors.push(`${prefix}: upload the actual licensed photo to your own storage first.`);
    if (!httpsUrl(row.sourceUrl)) errors.push(`${prefix}: sourceUrl must identify the supplier or manufacturer page.`);
    if (row.photoRightsConfirmed !== true) errors.push(`${prefix}: confirm permission to use this photo.`);
    const verified = row.commercialDataVerified === true && row.compatibilityReviewed === true;
    if (verified) {
      if (!(row.price > 0)) errors.push(`${prefix}: verified products need a real selling price greater than zero.`);
      for (const field of REQUIRED_COMPATIBILITY[row.category] || []) {
        const value = row.compatibilityData?.[field];
        const arrays = ['supportedSockets', 'supportedMotherboardSizes'];
        const numeric = ['tdp', 'length', 'recommendedPSU', 'maxRam', 'capacity', 'wattage', 'gpuMaxLength', 'cpuCoolerMaxHeight', 'height', 'tdpRating'];
        if (arrays.includes(field) && (!Array.isArray(value) || !value.every((item) => typeof item === 'string' && item.trim()))) errors.push(`${prefix}: ${field} must be a list of supported values.`);
        if (numeric.includes(field) && (typeof value !== 'number' || !Number.isFinite(value) || value <= 0)) errors.push(`${prefix}: ${field} must be a positive number.`);
        if (!arrays.includes(field) && !numeric.includes(field) && typeof value !== 'string') errors.push(`${prefix}: ${field} must be text.`);
        if (value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)) errors.push(`${prefix}: review compatibilityData.${field}.`);
      }
    }
    return {
      sku, mpn: row.mpn || '', name: row.name, brand: row.brand, category: row.category,
      price: row.price, stock: row.stock, description: row.description || '', image,
      specifications: row.specifications || {}, compatibilityData: row.compatibilityData || {},
      catalogVerified: verified, isArchived: !verified, archivedAt: verified ? null : new Date(),
      catalogSource: { url: row.sourceUrl, photoRightsConfirmed: true, importedAt: new Date() },
    };
  });
  return { errors, products: errors.length ? [] : products };
}
function importOperations(products) {
  // Never overwrite review aggregates, orders or other products. SKU is the stable key.
  return products.map((product) => ({ updateOne: { filter: { sku: product.sku }, update: { $set: product }, upsert: true } }));
}
module.exports = { validateCatalog, importOperations, REQUIRED_COMPATIBILITY, CATEGORIES };
