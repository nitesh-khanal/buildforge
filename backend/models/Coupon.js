const mongoose = require('mongoose');
const { CATEGORIES } = require('./Product');

// Phase 1 foundation for Phase 5 (Coupons + Discounts).
const DISCOUNT_TYPES = ['percentage', 'fixed'];

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
      index: true,
    },

    discountType: { type: String, enum: DISCOUNT_TYPES, required: true },
    // Percentage (0-100) or a flat NPR amount, depending on discountType —
    // validated below since the valid range differs per type.
    discountValue: { type: Number, required: true, min: 0 },

    minOrderAmount: { type: Number, default: 0, min: 0 },
    // Caps the peso/rupee amount a percentage coupon can discount (e.g. "20%
    // off, up to NPR 5000"). Not meaningful for fixed coupons — left null.
    maxDiscountAmount: { type: Number, default: null, min: 0 },

    startDate: { type: Date, required: true, default: Date.now },
    expiryDate: { type: Date, required: true },

    // null/undefined = unlimited. Both limits are enforced by the Phase 5
    // controller counting CouponUsage documents, not by trusting a
    // client-supplied number — usedCount here is a denormalized cache for
    // fast admin-dashboard display, same pattern as Product.rating vs.
    // Review documents.
    usageLimit: { type: Number, default: null, min: 1 },
    usageLimitPerUser: { type: Number, default: 1, min: 1 },
    usedCount: { type: Number, default: 0, min: 0 },

    isActive: { type: Boolean, default: true, index: true },

    // Empty arrays = applies to everything. Non-empty = restricts the
    // coupon to only those products/categories (the Phase 5 checkout
    // controller checks the cart's contents against these before allowing
    // the coupon).
    applicableProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    applicableCategories: [{ type: String, enum: CATEGORIES }],

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

couponSchema.pre('validate', function (next) {
  if (this.discountType === 'percentage' && this.discountValue > 100) {
    return next(new Error('A percentage discount cannot exceed 100.'));
  }
  if (this.expiryDate && this.startDate && this.expiryDate <= this.startDate) {
    return next(new Error('expiryDate must be after startDate.'));
  }
  next();
});

// "Is this coupon currently usable at all?" — independent of any specific
// order/user, which the Phase 5 controller checks separately (cart
// contents, per-user usage, minimum order amount).
couponSchema.methods.isCurrentlyValid = function () {
  const now = new Date();
  if (!this.isActive) return false;
  if (now < this.startDate || now > this.expiryDate) return false;
  if (this.usageLimit != null && this.usedCount >= this.usageLimit) return false;
  return true;
};

module.exports = mongoose.model('Coupon', couponSchema);
module.exports.DISCOUNT_TYPES = DISCOUNT_TYPES;
