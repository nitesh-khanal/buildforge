const Wishlist = require('../models/Wishlist');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const asyncHandler = require('../utils/asyncHandler');

// Wishlist requires login (join-row on `user` — see models/Wishlist.js), so
// every route here sits behind `protect` and `req.user` is always present.

// GET /api/wishlist
const getWishlist = asyncHandler(async (req, res) => {
  const items = await Wishlist.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .populate('product');

  // A wishlisted product can be deleted later (hard delete — see
  // PROGRESS.md known issues); drop those dangling entries from the
  // response rather than showing a broken card. They're cleaned up lazily
  // here rather than via a background job, matching this project's
  // scope (demo/portfolio-scale, not a hardened production deploy).
  const valid = items.filter((i) => i.product);

  res.json({ success: true, items: valid });
});

// GET /api/wishlist/status?productIds=id1,id2,... — for product
// cards/detail pages to light up the wishlist icon without fetching the
// full wishlist.
const getWishlistStatus = asyncHandler(async (req, res) => {
  const ids = String(req.query.productIds || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    return res.json({ success: true, wishlisted: [] });
  }

  const entries = await Wishlist.find({ user: req.user._id, product: { $in: ids } }).select('product');
  res.json({ success: true, wishlisted: entries.map((e) => e.product.toString()) });
});

// POST /api/wishlist  { productId }
const addToWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.body;
  const product = await Product.findById(productId);
  if (!product) {
    res.status(404);
    throw new Error('Product not found.');
  }

  try {
    const entry = await Wishlist.create({ user: req.user._id, product: productId });
    res.status(201).json({ success: true, item: { ...entry.toObject(), product } });
  } catch (err) {
    if (err.code === 11000) {
      // Already wishlisted — idempotent success rather than an error, since
      // the frontend heart toggle just wants "it's on the list" either way.
      return res.status(200).json({ success: true, message: 'Already in your wishlist.' });
    }
    throw err;
  }
});

// DELETE /api/wishlist/:productId
const removeFromWishlist = asyncHandler(async (req, res) => {
  await Wishlist.findOneAndDelete({ user: req.user._id, product: req.params.productId });
  res.json({ success: true });
});

// POST /api/wishlist/:productId/move-to-cart — adds the item to the user's
// cart (same stock/qty rules as cartController.addItem) and removes it from
// the wishlist on success. Wishlist-only (not guest carts), so this always
// resolves the cart by `req.user`, unlike cartController's dual guest/user
// lookup.
const moveToCart = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.productId);
  if (!product) {
    res.status(404);
    throw new Error('Product not found.');
  }
  if (product.stock <= 0) {
    res.status(400);
    throw new Error('This product is currently out of stock.');
  }

  let cart = await Cart.findOne({ user: req.user._id });
  if (!cart) cart = await Cart.create({ user: req.user._id });

  const existing = cart.items.find((i) => i.product && i.product.toString() === product._id.toString() && !i.isCustomBuild);
  const requestedQty = existing ? existing.quantity + 1 : 1;
  if (requestedQty > product.stock) {
    res.status(400);
    throw new Error(`Only ${product.stock} left in stock.`);
  }

  if (existing) {
    existing.quantity = requestedQty;
  } else {
    cart.items.push({
      product: product._id,
      name: product.name,
      image: product.image,
      price: product.price,
      quantity: 1,
    });
  }
  await cart.save();

  await Wishlist.findOneAndDelete({ user: req.user._id, product: product._id });

  res.json({ success: true, cart });
});

module.exports = {
  getWishlist,
  getWishlistStatus,
  addToWishlist,
  removeFromWishlist,
  moveToCart,
};
