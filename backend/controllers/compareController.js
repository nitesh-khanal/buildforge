const mongoose = require('mongoose');
const Product = require('../models/Product');
const asyncHandler = require('../utils/asyncHandler');
const { parseCompareIds, validateComparison, buildSpecKeyUnion } = require('../utils/compareUtils');

// GET /api/products/compare?ids=id1,id2,id3,id4 — Phase 3 (Product
// Comparison). No new model: reads directly from each product's existing
// `specifications`, and the response order mirrors the order ids were
// given in (the order the user added them to the comparison), not
// whatever order MongoDB happens to return them in.
//
// Phase 11: uses `Product.findActive` instead of `Product.find` — flagged
// as a follow-up in Phase 10's write-up ("None of these are purchase
// paths... the risk is a discontinued item appearing in a 'similar
// products' list"). Comparison is exactly that kind of discovery surface,
// so an archived product now silently drops out of the comparison result
// the same way it already drops out of `getRelatedProducts`/`getWorksWith`
// — the id-parsing/validation logic in `compareUtils.js` is untouched, it
// just receives a smaller `products` array when one of the requested ids
// is archived (surfacing as the existing "product not found" validation
// error if that leaves too few products to compare).
const compareProducts = asyncHandler(async (req, res) => {
  const ids = parseCompareIds(req.query.ids);
  const validIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));

  const found = await Product.findActive({ _id: { $in: validIds } });
  const byId = new Map(found.map((p) => [p._id.toString(), p]));
  const products = ids.map((id) => byId.get(id)).filter(Boolean);

  const { error } = validateComparison(ids, products);
  if (error) {
    res.status(400);
    throw new Error(error);
  }

  res.json({
    success: true,
    category: products[0].category,
    specKeys: buildSpecKeyUnion(products),
    products,
  });
});

module.exports = { compareProducts };
