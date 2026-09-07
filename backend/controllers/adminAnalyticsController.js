const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

// Orders in these paymentStatuses represent real, confirmed revenue.
// Pending (unconfirmed eSewa) and Failed orders are excluded everywhere
// below so the dashboard never overstates sales.
const CONFIRMED_PAYMENT_STATUSES = ['Paid', 'COD'];

// GET /api/admin/analytics/overview — the top-of-dashboard numbers.
const getOverview = asyncHandler(async (req, res) => {
  const [
    revenueAgg,
    totalOrders,
    pendingOrders,
    totalCustomers,
    totalProducts,
    lowStockCount,
    outOfStockCount,
  ] = await Promise.all([
    Order.aggregate([
      { $match: { paymentStatus: { $in: CONFIRMED_PAYMENT_STATUSES } } },
      // Phase 5: `discount` is summed alongside revenue/orders in the same
      // aggregate (confirmed orders only, per this file's existing rule)
      // rather than a separate query — it's the same document set.
      { $group: { _id: null, revenue: { $sum: '$total' }, orders: { $sum: 1 }, discount: { $sum: '$discount' } } },
    ]),
    Order.countDocuments(),
    Order.countDocuments({ orderStatus: 'Pending' }),
    User.countDocuments({ role: 'customer' }),
    Product.countDocuments(),
    Product.countDocuments({ stock: { $gt: 0, $lte: 3 } }),
    Product.countDocuments({ stock: { $lte: 0 } }),
  ]);

  const { revenue = 0, orders: confirmedOrders = 0, discount: totalDiscountGiven = 0 } = revenueAgg[0] || {};

  res.json({
    success: true,
    overview: {
      totalRevenue: revenue,
      totalDiscountGiven,
      confirmedOrders,
      totalOrders,
      pendingOrders,
      totalCustomers,
      totalProducts,
      lowStockCount,
      outOfStockCount,
      averageOrderValue: confirmedOrders ? Math.round(revenue / confirmedOrders) : 0,
    },
  });
});

// GET /api/admin/analytics/sales?period=daily|monthly&days=30 — revenue and
// order count grouped over time, confirmed orders only.
const getSalesOverTime = asyncHandler(async (req, res) => {
  const period = req.query.period === 'monthly' ? 'monthly' : 'daily';
  const days = Math.min(365, Number(req.query.days) || 30);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const dateFormat = period === 'monthly' ? '%Y-%m' : '%Y-%m-%d';

  const sales = await Order.aggregate([
    {
      $match: {
        paymentStatus: { $in: CONFIRMED_PAYMENT_STATUSES },
        createdAt: { $gte: since },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: dateFormat, date: '$createdAt' } },
        revenue: { $sum: '$total' },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, date: '$_id', revenue: 1, orders: 1 } },
  ]);

  res.json({ success: true, period, days, sales });
});

// GET /api/admin/analytics/top-products?limit=10 — best sellers by units
// and revenue. Counts both directly-purchased products AND components sold
// as part of a custom build (a CPU that only ever sells inside builds
// should still show up as a top seller).
const getTopProducts = asyncHandler(async (req, res) => {
  const limit = Math.min(50, Number(req.query.limit) || 10);

  const [directSales, buildComponentSales] = await Promise.all([
    Order.aggregate([
      { $match: { paymentStatus: { $in: CONFIRMED_PAYMENT_STATUSES } } },
      { $unwind: '$items' },
      { $match: { 'items.isCustomBuild': { $ne: true }, 'items.product': { $ne: null } } },
      {
        $group: {
          _id: '$items.product',
          name: { $first: '$items.name' },
          unitsSold: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        },
      },
    ]),
    Order.aggregate([
      { $match: { paymentStatus: { $in: CONFIRMED_PAYMENT_STATUSES } } },
      { $unwind: '$items' },
      { $match: { 'items.isCustomBuild': true } },
      { $unwind: '$items.buildComponents' },
      {
        $group: {
          _id: '$items.buildComponents.product',
          name: { $first: '$items.buildComponents.name' },
          unitsSold: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.buildComponents.price', '$items.quantity'] } },
        },
      },
    ]),
  ]);

  // Merge the two sources (a product can sell both standalone and inside
  // builds) by product id.
  const merged = new Map();
  for (const row of [...directSales, ...buildComponentSales]) {
    const key = row._id ? row._id.toString() : 'unknown';
    const existing = merged.get(key);
    if (existing) {
      existing.unitsSold += row.unitsSold;
      existing.revenue += row.revenue;
    } else {
      merged.set(key, { productId: row._id, name: row.name, unitsSold: row.unitsSold, revenue: row.revenue });
    }
  }

  const topProducts = [...merged.values()]
    .sort((a, b) => b.unitsSold - a.unitsSold)
    .slice(0, limit);

  res.json({ success: true, topProducts });
});

// GET /api/admin/analytics/category-breakdown — revenue and units by
// product category, again counting both standalone items and build
// components. Requires a $lookup into products for standalone items (their
// order-item snapshot doesn't carry category); build components already
// store category directly.
const getCategoryBreakdown = asyncHandler(async (req, res) => {
  const [directByCategory, buildByCategory] = await Promise.all([
    Order.aggregate([
      { $match: { paymentStatus: { $in: CONFIRMED_PAYMENT_STATUSES } } },
      { $unwind: '$items' },
      { $match: { 'items.isCustomBuild': { $ne: true }, 'items.product': { $ne: null } } },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'productDoc',
        },
      },
      { $unwind: { path: '$productDoc', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ['$productDoc.category', 'unknown'] },
          unitsSold: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        },
      },
    ]),
    Order.aggregate([
      { $match: { paymentStatus: { $in: CONFIRMED_PAYMENT_STATUSES } } },
      { $unwind: '$items' },
      { $match: { 'items.isCustomBuild': true } },
      { $unwind: '$items.buildComponents' },
      {
        $group: {
          _id: { $ifNull: ['$items.buildComponents.category', 'unknown'] },
          unitsSold: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.buildComponents.price', '$items.quantity'] } },
        },
      },
    ]),
  ]);

  const merged = new Map();
  for (const row of [...directByCategory, ...buildByCategory]) {
    const key = row._id;
    const existing = merged.get(key);
    if (existing) {
      existing.unitsSold += row.unitsSold;
      existing.revenue += row.revenue;
    } else {
      merged.set(key, { category: key, unitsSold: row.unitsSold, revenue: row.revenue });
    }
  }

  const breakdown = [...merged.values()].sort((a, b) => b.revenue - a.revenue);
  res.json({ success: true, breakdown });
});

module.exports = { getOverview, getSalesOverTime, getTopProducts, getCategoryBreakdown };
