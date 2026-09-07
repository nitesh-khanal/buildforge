const Order = require('../models/Order');
const Product = require('../models/Product');
const Notification = require('../models/Notification');
const asyncHandler = require('../utils/asyncHandler');
const { restockOrderItems } = require('../utils/inventory');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');
const { isValidPaymentTransition } = require('../utils/paymentTransitions');
const { runEsewaSweep } = require('../services/esewaSweepRunner');
const { ORDER_STATUSES, PAYMENT_STATUSES } = require('../models/Order');

// GET /api/admin/orders — filter by orderStatus/paymentStatus/paymentMethod,
// search by orderId or customer email, date range, paginated.
const listOrders = asyncHandler(async (req, res) => {
  const { orderStatus, paymentStatus, paymentMethod, search, from, to, page, limit } = req.query;

  const filter = {};
  if (orderStatus) filter.orderStatus = orderStatus;
  if (paymentStatus) filter.paymentStatus = paymentStatus;
  if (paymentMethod) filter.paymentMethod = paymentMethod;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }
  if (search) {
    const re = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ orderId: re }, { 'shippingAddress.email': re }, { 'shippingAddress.fullName': re }];
  }

  const pageNum = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(100, Number(limit) || 20);

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort('-createdAt')
      .skip((pageNum - 1) * pageSize)
      .limit(pageSize)
      .populate('user', 'name email'),
    Order.countDocuments(filter),
  ]);

  res.json({
    success: true,
    count: orders.length,
    total,
    page: pageNum,
    pages: Math.ceil(total / pageSize),
    orders,
  });
});

// GET /api/admin/orders/:id
const getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate('user', 'name email phone');
  if (!order) {
    res.status(404);
    throw new Error('Order not found.');
  }
  res.json({ success: true, order });
});

// PATCH /api/admin/orders/:id/status — body: { orderStatus: "Shipped" }.
// Moving to "Cancelled" from anything other than "Delivered" releases the
// stock that was reserved at checkout (same accounting as a failed eSewa
// payment — see orderController.esewaFailureCallback) so cancelled orders
// don't leave phantom reservations sitting in inventory.
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { orderStatus } = req.body;
  if (!orderStatus || !ORDER_STATUSES.includes(orderStatus)) {
    res.status(400);
    throw new Error(`orderStatus must be one of: ${ORDER_STATUSES.join(', ')}.`);
  }

  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error('Order not found.');
  }

  const previousStatus = order.orderStatus;
  if (previousStatus === orderStatus) {
    return res.json({ success: true, order });
  }
  if (previousStatus === 'Delivered' && orderStatus !== 'Delivered') {
    res.status(400);
    throw new Error('A delivered order cannot be moved to another status.');
  }
  if (previousStatus === 'Cancelled') {
    res.status(400);
    throw new Error('A cancelled order cannot be moved to another status.');
  }

  order.orderStatus = orderStatus;
  // Defensive fallback for orders created before Phase 9 added this field —
  // Mongoose lazily applies array defaults on first access for most cases,
  // but this guards against a `.push` on `undefined` either way.
  if (!order.statusHistory) order.statusHistory = [];
  order.statusHistory.push({ status: orderStatus, changedAt: new Date(), changedBy: 'admin' });

  if (orderStatus === 'Cancelled') {
    await restockOrderItems(Product, order.items);
    // A cancelled order was never fulfilled — if it had somehow been
    // marked Paid, that's now a refund situation, not a completed sale.
    if (order.paymentStatus === 'Paid') {
      order.paymentStatus = 'Refunded';
    }
  }

  await order.save();

  // Best-effort, never blocks the response — same fail-soft pattern as
  // every other notification call in this codebase.
  emailService.sendOrderStatusUpdateEmail(order, previousStatus).catch(() => {});
  notificationService.notifyOrderStatusChanged(Notification, order, previousStatus);

  res.json({ success: true, order });
});

// PATCH /api/admin/orders/:id/payment-status — manual override for edge
// cases (e.g. a COD order the courier collected cash for, or reconciling a
// support ticket) rather than something a customer-facing flow should ever
// need to touch directly.
const updatePaymentStatus = asyncHandler(async (req, res) => {
  const { paymentStatus } = req.body;
  if (!paymentStatus || !PAYMENT_STATUSES.includes(paymentStatus)) {
    res.status(400);
    throw new Error(`paymentStatus must be one of: ${PAYMENT_STATUSES.join(', ')}.`);
  }

  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error('Order not found.');
  }

  // Phase 9: previously any enum value was accepted with no transition
  // guard at all (unlike updateOrderStatus above, which already blocked
  // invalid orderStatus reversals) — an admin could set a fulfilled Paid or
  // COD order back to Pending by mistake. See utils/paymentTransitions.js
  // for the full allowed-transition table.
  if (!isValidPaymentTransition(order.paymentStatus, paymentStatus)) {
    res.status(400);
    throw new Error(`Payment status cannot move from ${order.paymentStatus} to ${paymentStatus}.`);
  }

  order.paymentStatus = paymentStatus;
  await order.save();
  res.json({ success: true, order });
});

// POST /api/admin/orders/sweep-esewa — manual on-demand trigger for the
// scheduled eSewa stale-Pending sweep (Phase 9), useful for support to force
// a reconciliation pass right now instead of waiting for the next interval.
const sweepEsewaOrders = asyncHandler(async (req, res) => {
  const summary = await runEsewaSweep();
  res.json({ success: true, summary });
});

module.exports = { listOrders, getOrder, updateOrderStatus, updatePaymentStatus, sweepEsewaOrders };
