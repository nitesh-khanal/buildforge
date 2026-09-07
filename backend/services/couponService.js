/**
 * Coupon evaluation for Phase 5 (Coupons + Discounts + Pricing). Wires up
 * the two Phase 1 models still sitting unused: `Coupon` and `CouponUsage`.
 *
 * Every function here is pure and DB-free — no `require('../models/...')`
 * at all — so it's directly unit-testable with zero mongoose dependency,
 * same convention as `ratingService.computeRatingAggregate` and
 * `compareUtils`'s pure functions. Callers (couponController,
 * orderController) do the actual `Coupon`/`CouponUsage`/`Product` reads and
 * pass plain data in: the coupon document, the cart/order items, a
 * productId -> {category} map for category-restricted coupons, and the
 * usage counts read from the `CouponUsage` ledger (never from
 * `Coupon.usedCount` alone — that field is only a denormalized display
 * cache, per the Phase 1 design note on the model itself).
 */

// A coupon's `applicableProducts`/`applicableCategories` restrict which
// *items* in the cart the discount is computed against — not whether the
// coupon can be used at all. Empty arrays (the common case) mean "applies
// to everything", so the eligible subtotal is just the full subtotal.
// `minOrderAmount` is checked separately, against the full cart subtotal,
// so a restricted coupon can still require a minimum overall order size.
function getEligibleSubtotal(items, productMap, coupon) {
  const hasProductRestriction = (coupon.applicableProducts || []).length > 0;
  const hasCategoryRestriction = (coupon.applicableCategories || []).length > 0;

  if (!hasProductRestriction && !hasCategoryRestriction) {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  const productIds = new Set((coupon.applicableProducts || []).map((id) => id.toString()));
  const categories = new Set(coupon.applicableCategories || []);

  function matches(productId, category) {
    if (productId && productIds.has(productId)) return true;
    if (category && categories.has(category)) return true;
    return false;
  }

  let eligible = 0;
  for (const item of items) {
    if (item.isCustomBuild) {
      // A custom build's line price is split across its components — each
      // component is checked individually so "10% off GPUs" can discount
      // just the GPU portion of a saved build, not the whole rig.
      for (const comp of item.buildComponents || []) {
        const productId = comp.product ? comp.product.toString() : null;
        const productInfo = productId ? productMap.get(productId) : null;
        if (matches(productId, comp.category || productInfo?.category)) {
          eligible += comp.price * item.quantity;
        }
      }
    } else if (item.product) {
      const productId = item.product.toString();
      const productInfo = productMap.get(productId);
      if (matches(productId, productInfo?.category)) {
        eligible += item.price * item.quantity;
      }
    }
  }
  return eligible;
}

// Percentage coupons discount a share of the eligible subtotal, capped by
// `maxDiscountAmount` if set ("20% off, up to NPR 5000"). Fixed coupons
// knock a flat amount off, but can never discount more than the eligible
// subtotal itself (no negative-price line items). Rounded to the nearest
// whole rupee/paisa-free NPR amount, matching how the rest of this
// codebase (emailService/notificationService) formats money.
function computeDiscountAmount(coupon, eligibleSubtotal) {
  if (eligibleSubtotal <= 0) return 0;

  let discount;
  if (coupon.discountType === 'percentage') {
    discount = (eligibleSubtotal * coupon.discountValue) / 100;
    if (coupon.maxDiscountAmount != null) {
      discount = Math.min(discount, coupon.maxDiscountAmount);
    }
  } else {
    discount = coupon.discountValue;
  }

  return Math.min(Math.round(discount), eligibleSubtotal);
}

// The single entry point both couponController (preview) and
// orderController (authoritative, at checkout) call. Returns
// `{ valid: true, discount, eligibleSubtotal }` or
// `{ valid: false, reason }` — `reason` is customer-facing, so it's kept
// specific enough to be useful ("expired" vs "not started yet" vs "usage
// limit") without leaking anything sensitive.
function evaluateCoupon({
  coupon,
  items,
  productMap = new Map(),
  subtotal,
  userUsageCount = 0,
  globalUsageCount = 0,
  now = new Date(),
}) {
  if (!coupon) {
    return { valid: false, reason: 'Coupon code not found.' };
  }
  if (!coupon.isActive) {
    return { valid: false, reason: 'This coupon is no longer active.' };
  }
  if (coupon.startDate && now < coupon.startDate) {
    return { valid: false, reason: 'This coupon is not active yet.' };
  }
  if (coupon.expiryDate && now > coupon.expiryDate) {
    return { valid: false, reason: 'This coupon has expired.' };
  }
  if (coupon.usageLimit != null && globalUsageCount >= coupon.usageLimit) {
    return { valid: false, reason: 'This coupon has reached its usage limit.' };
  }
  if (userUsageCount >= coupon.usageLimitPerUser) {
    return { valid: false, reason: "You've already used this coupon the maximum number of times." };
  }
  if (subtotal < (coupon.minOrderAmount || 0)) {
    return {
      valid: false,
      reason: `This coupon requires a minimum order of NPR ${Number(coupon.minOrderAmount).toLocaleString('en-IN')}.`,
    };
  }

  const eligibleSubtotal = getEligibleSubtotal(items, productMap, coupon);
  if (eligibleSubtotal <= 0) {
    return { valid: false, reason: 'None of the items in your cart are eligible for this coupon.' };
  }

  const discount = computeDiscountAmount(coupon, eligibleSubtotal);
  if (discount <= 0) {
    return { valid: false, reason: 'This coupon does not apply any discount to your order.' };
  }

  return { valid: true, discount, eligibleSubtotal };
}

// Every distinct product id referenced by a set of cart/order items
// (standalone items plus custom-build components) — what a caller needs to
// `Product.find({_id: {$in: [...]}})` before building the `productMap`
// `getEligibleSubtotal`/`evaluateCoupon` take, for a category-restricted
// coupon. Pure/DB-free, same reasoning as `utils/inventory.js`'s
// `flattenStockRequirements`.
function collectReferencedProductIds(items) {
  const ids = new Set();
  for (const item of items) {
    if (item.isCustomBuild) {
      for (const comp of item.buildComponents || []) {
        if (comp.product) ids.add(comp.product.toString());
      }
    } else if (item.product) {
      ids.add(item.product.toString());
    }
  }
  return [...ids];
}

module.exports = { getEligibleSubtotal, computeDiscountAmount, evaluateCoupon, collectReferencedProductIds };
