const Cart = require('../models/Cart');
const Product = require('../models/Product');
const asyncHandler = require('../utils/asyncHandler');
const { checkBuildCompatibility } = require('../services/compatibilityService');

// Guests are identified by an `x-session-id` header the frontend generates
// once (e.g. crypto.randomUUID()) and stores in localStorage. Once auth
// lands in Phase 2, a logged-in user's cart is looked up by req.user._id
// instead, and the guest cart is merged in on login.
function getCartOwnerFilter(req) {
  if (req.user) return { user: req.user._id };
  const sessionId = req.headers['x-session-id'];
  if (!sessionId) {
    const err = new Error('Missing x-session-id header for guest cart.');
    err.statusCode = 400;
    throw err;
  }
  return { sessionId };
}

async function findOrCreateCart(req) {
  const filter = getCartOwnerFilter(req);
  let cart = await Cart.findOne(filter);
  if (!cart) cart = await Cart.create(filter);
  return cart;
}

// GET /api/cart
const getCart = asyncHandler(async (req, res) => {
  const cart = await findOrCreateCart(req);
  res.json({ success: true, cart });
});

// POST /api/cart/items  { productId, quantity }
const addItem = asyncHandler(async (req, res) => {
  const { productId, quantity = 1 } = req.body;
  const product = await Product.findById(productId);
  if (!product) {
    res.status(404);
    throw new Error('Product not found.');
  }
  // Phase 10: an archived (soft-deleted) product still resolves for its
  // detail page, but can never be (re-)added to a cart — same
  // backend-authoritative spirit as the stock check right below it.
  if (product.isArchived) {
    res.status(400);
    throw new Error('This product is no longer available.');
  }
  if (product.stock <= 0) {
    res.status(400);
    throw new Error('This product is currently out of stock.');
  }

  const cart = await findOrCreateCart(req);
  const existing = cart.items.find(
    (i) => i.product && i.product.toString() === productId && !i.isCustomBuild
  );

  const requestedQty = existing ? existing.quantity + Number(quantity) : Number(quantity);
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
      quantity: Number(quantity),
    });
  }

  await cart.save();
  res.status(201).json({ success: true, cart });
});

// POST /api/cart/custom-build  { name, components: [{productId, quantity?}] }
// Adds a full PC build (from the /build page) as a single cart line while
// retaining each component so inventory can still be decremented per part.
const addCustomBuild = asyncHandler(async (req, res) => {
  const { components } = req.body;
  if (!Array.isArray(components) || components.length === 0) {
    res.status(400);
    throw new Error('A custom build requires at least one component.');
  }

  const ids = components.map((c) => c.productId);
  const products = await Product.find({ _id: { $in: ids } });
  if (products.length !== ids.length) {
    res.status(404);
    throw new Error('One or more build components could not be found.');
  }

  for (const p of products) {
    if (p.isArchived) {
      res.status(400);
      throw new Error(`${p.name} is no longer available.`);
    }
    if (p.stock <= 0) {
      res.status(400);
      throw new Error(`${p.name} is out of stock.`);
    }
  }

  // Business rule #5: invalid PC builds cannot be checked out. Re-validate
  // using the same compatibility service the /build page uses, so a build
  // that shows "Compatible" in the UI is the only kind that can be ordered.
  const componentsByCategory = products.reduce((acc, p) => {
    acc[p.category] = p;
    return acc;
  }, {});
  const report = checkBuildCompatibility(componentsByCategory);
  if (report.errors.length > 0) {
    res.status(400);
    throw new Error(
      `This build has compatibility issues and cannot be added to cart: ${report.errors.map((e) => e.message).join(' ')}`
    );
  }

  const buildComponents = products.map((p) => ({
    product: p._id,
    name: p.name,
    category: p.category,
    price: p.price,
  }));
  const total = buildComponents.reduce((sum, c) => sum + c.price, 0);

  const cart = await findOrCreateCart(req);
  cart.items.push({
    name: 'Custom PC Build',
    image: products.find((p) => p.category === 'gpu')?.image || products[0].image,
    price: total,
    quantity: 1,
    isCustomBuild: true,
    buildComponents,
  });

  await cart.save();
  res.status(201).json({ success: true, cart });
});

// PATCH /api/cart/items/:itemId  { quantity }
const updateItemQuantity = asyncHandler(async (req, res) => {
  const { quantity } = req.body;
  if (!quantity || quantity < 1) {
    res.status(400);
    throw new Error('Quantity must be at least 1.');
  }

  const cart = await findOrCreateCart(req);
  const item = cart.items.id(req.params.itemId);
  if (!item) {
    res.status(404);
    throw new Error('Cart item not found.');
  }

  if (!item.isCustomBuild && item.product) {
    const product = await Product.findById(item.product);
    if (product && quantity > product.stock) {
      res.status(400);
      throw new Error(`Only ${product.stock} left in stock.`);
    }
  }

  item.quantity = quantity;
  await cart.save();
  res.json({ success: true, cart });
});

// DELETE /api/cart/items/:itemId
const removeItem = asyncHandler(async (req, res) => {
  const cart = await findOrCreateCart(req);
  cart.items.id(req.params.itemId)?.deleteOne();
  await cart.save();
  res.json({ success: true, cart });
});

// DELETE /api/cart
const clearCart = asyncHandler(async (req, res) => {
  const cart = await findOrCreateCart(req);
  cart.items = [];
  await cart.save();
  res.json({ success: true, cart });
});

module.exports = {
  getCart,
  addItem,
  addCustomBuild,
  updateItemQuantity,
  removeItem,
  clearCart,
};
