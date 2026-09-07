const User = require('../models/User');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const asyncHandler = require('../utils/asyncHandler');
const { sendTokenResponse } = require('../utils/jwt');
const { mergeCartItems } = require('../utils/mergeCartItems');

// Merges a guest cart (identified by x-session-id) into the user's cart on
// login/register, so items added while browsing aren't lost.
//
// Phase 9 bug fix (see BUILD_FORGE_PROGRESS.md's "Known bugs" section): this
// used to just concatenate the guest cart's items onto the user cart array,
// so a product already sitting in both carts ended up as two separate line
// items instead of one line item with a summed quantity. `mergeCartItems`
// (utils/mergeCartItems.js) now sums matching standalone items instead, and
// a live stock lookup keeps the merged quantity from exceeding what's
// actually available (same cap cartController.addItem already enforces
// when adding a single item).
async function mergeGuestCart(sessionId, userId) {
  if (!sessionId) return;

  const guestCart = await Cart.findOne({ sessionId });
  if (!guestCart || guestCart.items.length === 0) return;

  let userCart = await Cart.findOne({ user: userId });
  if (!userCart) {
    guestCart.user = userId;
    guestCart.sessionId = undefined;
    await guestCart.save();
    return;
  }

  const productIds = [...userCart.items, ...guestCart.items]
    .filter((i) => !i.isCustomBuild && i.product)
    .map((i) => i.product.toString());
  const products = productIds.length ? await Product.find({ _id: { $in: productIds } }) : [];
  const stockByProductId = new Map(products.map((p) => [p._id.toString(), p.stock]));

  userCart.items = mergeCartItems(userCart.items, guestCart.items, stockByProductId);
  await userCart.save();
  await guestCart.deleteOne();
}

// POST /api/auth/register
const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    throw new Error('Name, email and password are required.');
  }
  if (password.length < 8) {
    res.status(400);
    throw new Error('Password must be at least 8 characters.');
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    res.status(400);
    throw new Error('An account with this email already exists.');
  }

  const user = await User.create({ name, email, password, phone, role: 'customer' });

  await mergeGuestCart(req.headers['x-session-id'], user._id);

  sendTokenResponse(res, 201, user);
});

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error('Email and password are required.');
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    res.status(401);
    throw new Error('Invalid email or password.');
  }

  await mergeGuestCart(req.headers['x-session-id'], user._id);

  sendTokenResponse(res, 200, user);
});

// POST /api/auth/logout
const logout = asyncHandler(async (req, res) => {
  res.cookie('token', '', { httpOnly: true, expires: new Date(0) });
  res.json({ success: true, message: 'Logged out.' });
});

// GET /api/auth/me
const getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user.toSafeObject() });
});

// PATCH /api/auth/me
const updateMe = asyncHandler(async (req, res) => {
  const { name, phone, address } = req.body;
  const user = await User.findById(req.user._id);

  if (name) user.name = name;
  if (phone) user.phone = phone;
  if (address) user.address = { ...user.address?.toObject?.(), ...address };

  await user.save();
  res.json({ success: true, user: user.toSafeObject() });
});

// PATCH /api/auth/password
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.length < 8) {
    res.status(400);
    throw new Error('Current password and a new password (min 8 chars) are required.');
  }

  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(currentPassword))) {
    res.status(401);
    throw new Error('Current password is incorrect.');
  }

  user.password = newPassword;
  await user.save();
  sendTokenResponse(res, 200, user);
});

module.exports = { register, login, logout, getMe, updateMe, changePassword };
