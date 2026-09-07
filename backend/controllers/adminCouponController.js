const Coupon = require('../models/Coupon');
const CouponUsage = require('../models/CouponUsage');
const asyncHandler = require('../utils/asyncHandler');

const EDITABLE_FIELDS = [
  'code',
  'discountType',
  'discountValue',
  'minOrderAmount',
  'maxDiscountAmount',
  'startDate',
  'expiryDate',
  'usageLimit',
  'usageLimitPerUser',
  'isActive',
  'applicableProducts',
  'applicableCategories',
];

function applyFields(doc, body) {
  for (const field of EDITABLE_FIELDS) {
    if (body[field] !== undefined) doc[field] = body[field];
  }
}

// GET /api/admin/coupons?search=&status=active|inactive|expired&page=&limit=
const listCoupons = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

  const filter = {};
  if (req.query.search) {
    filter.code = { $regex: req.query.search.trim(), $options: 'i' };
  }
  if (req.query.status === 'active') {
    filter.isActive = true;
    filter.expiryDate = { $gte: new Date() };
  } else if (req.query.status === 'inactive') {
    filter.isActive = false;
  } else if (req.query.status === 'expired') {
    filter.expiryDate = { $lt: new Date() };
  }

  const [coupons, total] = await Promise.all([
    Coupon.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Coupon.countDocuments(filter),
  ]);

  res.json({ success: true, coupons, total, page, pages: Math.ceil(total / limit) || 1 });
});

// GET /api/admin/coupons/:id — includes real usage-ledger counts alongside
// the coupon, since `usedCount` on the document itself is only a
// denormalized cache (see models/Coupon.js).
const getCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) {
    res.status(404);
    throw new Error('Coupon not found.');
  }
  const usageCount = await CouponUsage.countDocuments({ coupon: coupon._id });
  res.json({ success: true, coupon, usageCount });
});

// POST /api/admin/coupons
const createCoupon = asyncHandler(async (req, res) => {
  const { code, discountType, discountValue, expiryDate } = req.body;
  if (!code || !discountType || discountValue === undefined || !expiryDate) {
    res.status(400);
    throw new Error('code, discountType, discountValue, and expiryDate are required.');
  }

  const doc = new Coupon({ createdBy: req.user._id });
  applyFields(doc, req.body);

  try {
    await doc.save();
  } catch (err) {
    if (err.code === 11000) {
      res.status(409);
      throw new Error('A coupon with this code already exists.');
    }
    throw err;
  }

  res.status(201).json({ success: true, coupon: doc });
});

// PUT /api/admin/coupons/:id
const updateCoupon = asyncHandler(async (req, res) => {
  const doc = await Coupon.findById(req.params.id);
  if (!doc) {
    res.status(404);
    throw new Error('Coupon not found.');
  }

  applyFields(doc, req.body);

  try {
    await doc.save();
  } catch (err) {
    if (err.code === 11000) {
      res.status(409);
      throw new Error('A coupon with this code already exists.');
    }
    throw err;
  }

  res.json({ success: true, coupon: doc });
});

// PATCH /api/admin/coupons/:id/toggle — flips isActive. A dedicated action
// (rather than requiring a full PUT) for the common "pause this coupon"
// case in the admin table.
const toggleCoupon = asyncHandler(async (req, res) => {
  const doc = await Coupon.findById(req.params.id);
  if (!doc) {
    res.status(404);
    throw new Error('Coupon not found.');
  }
  doc.isActive = !doc.isActive;
  await doc.save();
  res.json({ success: true, coupon: doc });
});

// DELETE /api/admin/coupons/:id — blocked once a coupon has actually been
// redeemed: CouponUsage rows reference it, and (unlike the pre-existing,
// already-flagged-as-a-bug hard delete on Product) there's no reason to
// repeat that mistake here when "deactivate" (see toggleCoupon above)
// covers the same "stop this coupon working" need without breaking
// historical order/usage records.
const deleteCoupon = asyncHandler(async (req, res) => {
  const doc = await Coupon.findById(req.params.id);
  if (!doc) {
    res.status(404);
    throw new Error('Coupon not found.');
  }

  const usageCount = await CouponUsage.countDocuments({ coupon: doc._id });
  if (usageCount > 0) {
    res.status(400);
    throw new Error('This coupon has already been used and cannot be deleted — deactivate it instead.');
  }

  await doc.deleteOne();
  res.json({ success: true });
});

module.exports = { listCoupons, getCoupon, createCoupon, updateCoupon, toggleCoupon, deleteCoupon };
