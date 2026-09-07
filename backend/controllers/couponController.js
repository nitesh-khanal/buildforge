const Coupon = require('../models/Coupon');
const CouponUsage = require('../models/CouponUsage');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const asyncHandler = require('../utils/asyncHandler');
const { evaluateCoupon, collectReferencedProductIds } = require('../services/couponService');

// Coupon has no guest concept — same convention as wishlist/addresses —
// since usage limits are tracked per-user (see routes/couponRoutes.js).

// Shared by validateCoupon (preview) and orderController.createOrder
// (authoritative, at checkout) so the two never drift: reads the caller's
// cart, builds the productId -> {category} map a restricted coupon needs,
// and returns evaluateCoupon()'s verdict.
async function evaluateCouponForUser({ code, userId }) {
  const coupon = await Coupon.findOne({ code: code.trim().toUpperCase() });

  const cart = await Cart.findOne({ user: userId });
  if (!cart || cart.items.length === 0) {
    const err = new Error('Your cart is empty.');
    err.statusCode = 400;
    throw err;
  }

  const subtotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const productIds = collectReferencedProductIds(cart.items);
  const products = productIds.length ? await Product.find({ _id: { $in: productIds } }).select('category') : [];
  const productMap = new Map(products.map((p) => [p._id.toString(), p]));

  const [userUsageCount, globalUsageCount] = coupon
    ? await Promise.all([
        CouponUsage.countDocuments({ coupon: coupon._id, user: userId }),
        CouponUsage.countDocuments({ coupon: coupon._id }),
      ])
    : [0, 0];

  const result = evaluateCoupon({
    coupon,
    items: cart.items,
    productMap,
    subtotal,
    userUsageCount,
    globalUsageCount,
  });

  return { coupon, result };
}

// POST /api/coupons/validate  { code }
// A preview endpoint — nothing is reserved or recorded here. The
// authoritative discount is (re)computed against the live cart inside
// orderController.createOrder at actual checkout time, so a coupon that
// stops qualifying between "apply" and "place order" (cart changed, coupon
// expired, someone else used up the last redemption) can never desync the
// order total from what the customer is charged.
const validateCoupon = asyncHandler(async (req, res) => {
  const code = (req.body.code || '').trim();
  if (!code) {
    res.status(400);
    throw new Error('Please enter a coupon code.');
  }

  const { result } = await evaluateCouponForUser({ code, userId: req.user._id });

  if (!result.valid) {
    return res.status(400).json({ success: false, valid: false, message: result.reason });
  }

  res.json({
    success: true,
    valid: true,
    code: code.trim().toUpperCase(),
    discount: result.discount,
  });
});

module.exports = { validateCoupon, evaluateCouponForUser };
