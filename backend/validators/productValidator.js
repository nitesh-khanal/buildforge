// Lightweight validation for admin product create/update. `specifications`
// and `compatibilityData` are intentionally free-form (Mixed in the schema)
// since every category shapes them differently — see seed/products.js for
// the conventions the compatibility/recommendation engines expect. This
// only guards the fields every product needs regardless of category.

const { CATEGORIES } = require('../models/Product');

// `partial: true` for PATCH-style updates, where a field simply being
// absent is fine (only validate the fields that were actually sent).
function validateProductInput(body, { partial = false } = {}) {
  const errors = [];
  const has = (field) => Object.prototype.hasOwnProperty.call(body, field);

  if ((!partial || has('name')) && (!body.name || !String(body.name).trim())) {
    errors.push('name is required.');
  }
  if ((!partial || has('brand')) && (!body.brand || !String(body.brand).trim())) {
    errors.push('brand is required.');
  }
  if (!partial || has('category')) {
    if (!body.category || !CATEGORIES.includes(body.category)) {
      errors.push(`category must be one of: ${CATEGORIES.join(', ')}.`);
    }
  }
  if (!partial || has('price')) {
    if (body.price === undefined || body.price === null || Number.isNaN(Number(body.price)) || Number(body.price) < 0) {
      errors.push('price must be a non-negative number.');
    }
  }
  if (has('stock')) {
    if (Number.isNaN(Number(body.stock)) || Number(body.stock) < 0) {
      errors.push('stock must be a non-negative number.');
    }
  }
  if (has('rating')) {
    const r = Number(body.rating);
    if (Number.isNaN(r) || r < 0 || r > 5) {
      errors.push('rating must be between 0 and 5.');
    }
  }
  if (has('specifications') && typeof body.specifications !== 'object') {
    errors.push('specifications must be an object.');
  }
  if (has('compatibilityData') && typeof body.compatibilityData !== 'object') {
    errors.push('compatibilityData must be an object.');
  }

  return errors;
}

module.exports = { validateProductInput };
