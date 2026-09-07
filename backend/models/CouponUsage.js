const mongoose = require('mongoose');

// Phase 1 foundation for Phase 5 (Coupons + Discounts).
//
// Source-of-truth ledger of coupon redemptions. Coupon.usedCount (a plain
// number) is a denormalized cache for quick admin-dashboard display; the
// actual "has this user already used this coupon N times?" and "has this
// coupon hit its global usage limit?" checks should count documents here,
// the same way order revenue is computed from real Order documents rather
// than a running total.
const couponUsageSchema = new mongoose.Schema(
  {
    coupon: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // One coupon application per order — also what makes a duplicate/retried
    // checkout request safe to no-op against instead of double-counting.
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    discountApplied: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

// Powers "how many times has this user used this coupon?" for the
// per-user usage limit check.
couponUsageSchema.index({ coupon: 1, user: 1 });

module.exports = mongoose.model('CouponUsage', couponUsageSchema);
