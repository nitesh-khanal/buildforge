const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const Notification = require('../models/Notification');
const Coupon = require('../models/Coupon');
const CouponUsage = require('../models/CouponUsage');
const asyncHandler = require('../utils/asyncHandler');
const generateOrderId = require('../utils/generateOrderId');
const esewaService = require('../services/esewaService');
const orderNotificationService = require('../services/orderNotificationService');
const notificationService = require('../services/notificationService');
const emailService = require('../services/emailService');
const { evaluateCoupon } = require('../services/couponService');
const { flattenStockRequirements, restockOrderItems: restockItems } = require('../utils/inventory');
const { estimateDeliveryDate } = require('../utils/delivery');

// Order statuses a customer is still allowed to self-cancel from — once an
// order has started moving (Processing or later) it's out for fulfillment
// and only an admin can adjust it, same boundary the shipping-partner
// handoff already treats as "this order is now in motion".
const CUSTOMER_CANCELLABLE_STATUSES = ['Pending', 'Confirmed'];

// Where eSewa should redirect the browser back to after payment — must be a
// publicly reachable URL pointing at THIS backend (not the frontend), since
// the callback needs to hit our verification routes before the customer
// ever sees the frontend's confirmation page.
function backendUrl() {
  return process.env.BACKEND_URL || 'http://localhost:5000';
}

const SHIPPING_COST = 300; // flat rate NPR; free-shipping threshold logic can be added later
const FREE_SHIPPING_THRESHOLD = 100000;

function validateShippingAddress(addr) {
  const required = ['fullName', 'email', 'phone', 'address', 'city', 'province'];
  const missing = required.filter((f) => !addr || !addr[f]);
  if (missing.length) {
    const err = new Error(`Missing shipping details: ${missing.join(', ')}.`);
    err.statusCode = 400;
    throw err;
  }
}

// Expands cart items into a flat list of { productId, quantity } for stock
// checks — a custom build's components each need exactly 1 unit decremented.
// (Re-exported from utils/inventory.js so this file's existing call sites
// don't need to change.)

// Simulated card payment for the demo/free environment. No real gateway is
// called and no card data is ever persisted (see business rule #9). A test
// card number ending in 0000 simulates a decline so the "failed payment
// never creates a paid order" rule (#7) can actually be exercised/tested.
// Real gateway integration is a Phase 5 concern (see ROADMAP.md).
function simulateCardPayment(cardDetails) {
  if (!cardDetails || !cardDetails.cardNumber || !cardDetails.expiry || !cardDetails.cvv) {
    const err = new Error('Card details are incomplete.');
    err.statusCode = 400;
    throw err;
  }
  const last4 = cardDetails.cardNumber.replace(/\s/g, '').slice(-4);
  return last4 === '0000' ? 'Failed' : 'Paid';
}

// POST /api/orders — checkout. Requires auth (see business rule #2).
const createOrder = asyncHandler(async (req, res) => {
  const { shippingAddress, paymentMethod, cardDetails, couponCode } = req.body;

  validateShippingAddress(shippingAddress);
  if (!['card', 'cod', 'esewa'].includes(paymentMethod)) {
    res.status(400);
    throw new Error('Invalid payment method.');
  }

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart || cart.items.length === 0) {
    res.status(400);
    throw new Error('Your cart is empty.');
  }

  // Re-check stock at checkout time — it may have changed since items were
  // added to the cart (business rule #4/#6).
  const requirements = flattenStockRequirements(cart.items);
  const products = await Product.find({ _id: { $in: [...requirements.keys()] } });
  const productMap = new Map(products.map((p) => [p._id.toString(), p]));

  for (const [productId, qtyNeeded] of requirements) {
    const product = productMap.get(productId);
    if (!product) {
      res.status(400);
      throw new Error('One of the items in your cart is no longer available.');
    }
    if (product.stock < qtyNeeded) {
      res.status(400);
      throw new Error(`${product.name} does not have enough stock left (only ${product.stock} available).`);
    }
  }

  const subtotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Coupon (Phase 5) — re-evaluated here from scratch against the live
  // cart rather than trusting whatever discount amount the frontend's
  // `POST /api/coupons/validate` preview showed earlier; that endpoint can
  // go stale (cart changed, coupon expired, someone else used up the last
  // redemption) between "apply" and "place order". An invalid/expired code
  // at this point fails the whole checkout rather than silently charging
  // full price, so the customer isn't surprised by a total that doesn't
  // match what they saw at checkout.
  let discount = 0;
  let normalizedCouponCode = null;
  let appliedCoupon = null;
  if (couponCode && couponCode.trim()) {
    normalizedCouponCode = couponCode.trim().toUpperCase();
    appliedCoupon = await Coupon.findOne({ code: normalizedCouponCode });

    const productMapForCoupon = productMap; // already built above for the stock check
    const [userUsageCount, globalUsageCount] = appliedCoupon
      ? await Promise.all([
          CouponUsage.countDocuments({ coupon: appliedCoupon._id, user: req.user._id }),
          CouponUsage.countDocuments({ coupon: appliedCoupon._id }),
        ])
      : [0, 0];

    const couponResult = evaluateCoupon({
      coupon: appliedCoupon,
      items: cart.items,
      productMap: productMapForCoupon,
      subtotal,
      userUsageCount,
      globalUsageCount,
    });

    if (!couponResult.valid) {
      res.status(400);
      throw new Error(couponResult.reason);
    }
    discount = couponResult.discount;
  }

  const shippingCost = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
  const total = subtotal + shippingCost - discount;

  // Determine payment status per method (business rules #7, #8, #9).
  let paymentStatus = 'Pending';
  if (paymentMethod === 'cod') {
    paymentStatus = 'COD';
  } else if (paymentMethod === 'card') {
    paymentStatus = simulateCardPayment(cardDetails);
    if (paymentStatus === 'Failed') {
      res.status(402);
      throw new Error('Payment could not be completed. Please check your card details or try another payment method.');
    }
  } else if (paymentMethod === 'esewa') {
    // Real gateway: stays Pending until eSewa's redirect callback (or a
    // manual status check) confirms it — see esewaSuccessCallback below.
    paymentStatus = 'Pending';
  }

  const orderId = await generateOrderId();

  const session = await mongoose.startSession();
  let order;
  try {
    await session.withTransaction(async () => {
      order = await Order.create(
        [
          {
            orderId,
            user: req.user._id,
            items: cart.items,
            shippingAddress,
            paymentMethod,
            paymentStatus,
            orderStatus: 'Pending',
            subtotal,
            shippingCost,
            discount,
            couponCode: normalizedCouponCode,
            total,
            estimatedDeliveryDate: estimateDeliveryDate(new Date(), { paymentMethod }),
            statusHistory: [{ status: 'Pending', changedAt: new Date(), changedBy: 'system' }],
          },
        ],
        { session }
      );
      order = order[0];

      // Decrement inventory (business rule #6) — done inside the same
      // transaction as order creation so a crash can't decrement stock
      // without a matching order existing.
      //
      // Phase 9 (inventory concurrency fix): the pre-transaction stock check
      // above is only a friendly early check — it reads stock, then this
      // block writes it, and nothing stopped a second, simultaneous checkout
      // for the last unit(s) of the same product from passing that same
      // read before either transaction committed, so a blind `$inc` here
      // could decrement stock below zero. Each decrement is now a single
      // atomic conditional update (`stock: { $gte: qty }` in the filter, not
      // just the update), so MongoDB itself refuses the write if another
      // concurrent transaction already consumed the remaining stock. If any
      // item's conditional update doesn't match, the whole transaction is
      // aborted (throwing inside `withTransaction` rolls everything back —
      // no order is left half-created and no other item's stock is left
      // decremented).
      for (const [productId, qty] of requirements) {
        const result = await Product.updateOne(
          { _id: productId, stock: { $gte: qty } },
          { $inc: { stock: -qty } },
          { session }
        );
        if (result.matchedCount === 0) {
          const product = productMap.get(productId);
          res.status(409);
          throw new Error(
            `${product ? product.name : 'One of the items in your cart'} was just purchased by someone else and no longer has enough stock. Please update your cart and try again.`
          );
        }
      }

      // Record the redemption (Phase 5) in the same transaction as the
      // order itself — CouponUsage is the append-only source of truth for
      // usage-limit enforcement (see models/CouponUsage.js), so it must
      // exist if and only if the order it's tied to does.
      // `Coupon.usedCount` is only a denormalized display cache; it's
      // bumped alongside for fast admin-dashboard reads.
      if (appliedCoupon && discount > 0) {
        await CouponUsage.create(
          [{ coupon: appliedCoupon._id, user: req.user._id, order: order._id, discountApplied: discount }],
          { session }
        );
        await Coupon.updateOne({ _id: appliedCoupon._id }, { $inc: { usedCount: 1 } }, { session });
      }

      cart.items = [];
      await cart.save({ session });
    });
  } finally {
    session.endSession();
  }

  // eSewa: hand the frontend the signed form fields it needs to redirect
  // the customer to eSewa's hosted payment page. Nothing is confirmed yet.
  let esewaPayment = null;
  if (paymentMethod === 'esewa') {
    esewaPayment = esewaService.buildPaymentPayload(order, { backendUrl: backendUrl() });
  }

  // In-app "order placed" notification (Phase 4) — fired for every order
  // regardless of payment method/status, separate from the email/shipping
  // side effects below which only fire once a payment is actually
  // confirmed. Fail-soft internally; never blocks checkout.
  await notificationService.notifyOrderPlaced(Notification, order);

  // COD and successful card payments are confirmed immediately — fire the
  // confirmation email + shipping-partner handoff now. (eSewa waits for the
  // callback in esewaSuccessCallback below, since it isn't confirmed yet.)
  if (paymentStatus === 'COD' || paymentStatus === 'Paid') {
    const notifications = await orderNotificationService.notifyOrderConfirmed(order);
    order.notifications = notifications;
    await order.save();
    if (paymentStatus === 'Paid') {
      await notificationService.notifyPaymentSuccessful(Notification, order);
    }
  }

  res.status(201).json({ success: true, order, esewaPayment });
});

// GET /api/orders/esewa/success — eSewa redirects the customer's browser
// here with `?data=<base64 JSON>` after a completed (or attempted) payment.
// No `protect` middleware: eSewa itself hits this URL, verified via HMAC
// signature rather than a JWT. Ends in a redirect to the frontend so the
// customer lands on a normal page, not a raw JSON response.
const esewaSuccessCallback = asyncHandler(async (req, res) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const payload = esewaService.decodeCallbackData(req.query.data);

  if (!payload || !esewaService.verifySignature(payload)) {
    return res.redirect(`${clientUrl}/order-confirmation?status=invalid`);
  }

  const order = await Order.findOne({ orderId: payload.transaction_uuid, paymentMethod: 'esewa' });
  if (!order) {
    return res.redirect(`${clientUrl}/order-confirmation?status=not_found`);
  }

  // Independent double-check against eSewa's own status API rather than
  // trusting the redirect payload alone — belt and suspenders against a
  // replayed or forged callback.
  let statusCheck;
  try {
    statusCheck = await esewaService.checkTransactionStatus({
      transactionUuid: order.orderId,
      totalAmount: order.total,
    });
  } catch (err) {
    return res.redirect(`${clientUrl}/order-confirmation/${order.orderId}?status=verification_error`);
  }

  if (statusCheck.status === 'COMPLETE' && order.paymentStatus !== 'Paid') {
    order.paymentStatus = 'Paid';
    order.esewaDetails = {
      refId: statusCheck.ref_id,
      status: statusCheck.status,
      verifiedAt: new Date(),
    };
    const notifications = await orderNotificationService.notifyOrderConfirmed(order);
    order.notifications = notifications;
    await order.save();
    await notificationService.notifyPaymentSuccessful(Notification, order);
    return res.redirect(`${clientUrl}/order-confirmation/${order.orderId}?status=success`);
  }

  if (statusCheck.status === 'COMPLETE') {
    // Already marked Paid (e.g. duplicate callback) — just send them along.
    return res.redirect(`${clientUrl}/order-confirmation/${order.orderId}?status=success`);
  }

  return res.redirect(`${clientUrl}/order-confirmation/${order.orderId}?status=pending`);
});

// GET /api/orders/esewa/failure — eSewa's failure redirect. Releases the
// stock that was reserved at checkout time (business rule #7: a failed
// payment never results in a paid order — and it shouldn't leave phantom
// stock reservations behind either) and lets the customer know by email.
const esewaFailureCallback = asyncHandler(async (req, res) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const transactionUuid = req.query.transaction_uuid || req.query.data;

  if (!transactionUuid) {
    return res.redirect(`${clientUrl}/order-confirmation?status=failed`);
  }

  const order = await Order.findOne({ orderId: transactionUuid, paymentMethod: 'esewa' });
  if (!order || order.paymentStatus === 'Paid') {
    // Nothing to release, or it turns out it did complete — don't restock.
    return res.redirect(`${clientUrl}/order-confirmation/${transactionUuid}?status=failed`);
  }

  if (order.paymentStatus !== 'Failed') {
    order.paymentStatus = 'Failed';
    order.orderStatus = 'Cancelled';
    await order.save();
    await restockItems(Product, order.items);
    await orderNotificationService.notifyPaymentFailed(order);
    await notificationService.notifyPaymentFailedInApp(Notification, order);
  }

  return res.redirect(`${clientUrl}/order-confirmation/${order.orderId}?status=failed`);
});

// GET /api/orders/:id/esewa-status — manual reconciliation for when the
// customer's browser never makes it back to us (closed the tab, flaky
// connection, etc). Owner or admin only. Applies the same COMPLETE-confirms
// / else-restocks logic as the redirect callbacks above.
const checkEsewaStatus = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error('Order not found.');
  }
  if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    res.status(403);
    throw new Error('You are not authorized to view this order.');
  }
  if (order.paymentMethod !== 'esewa') {
    res.status(400);
    throw new Error('This order was not paid via eSewa.');
  }

  const statusCheck = await esewaService.checkTransactionStatus({
    transactionUuid: order.orderId,
    totalAmount: order.total,
  });

  if (statusCheck.status === 'COMPLETE' && order.paymentStatus !== 'Paid') {
    order.paymentStatus = 'Paid';
    order.esewaDetails = { refId: statusCheck.ref_id, status: statusCheck.status, verifiedAt: new Date() };
    order.notifications = await orderNotificationService.notifyOrderConfirmed(order);
    await order.save();
    await notificationService.notifyPaymentSuccessful(Notification, order);
  } else if (['CANCELED', 'NOT_FOUND', 'EXPIRED'].includes(statusCheck.status) && order.paymentStatus === 'Pending') {
    order.paymentStatus = 'Failed';
    order.orderStatus = 'Cancelled';
    await order.save();
    await restockItems(Product, order.items);
    await notificationService.notifyPaymentFailedInApp(Notification, order);
  }

  res.json({ success: true, order, esewaStatus: statusCheck });
});

// GET /api/orders — current user's order history
const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort('-createdAt');
  res.json({ success: true, count: orders.length, orders });
});

// GET /api/orders/:id — a single order (owner or admin only). Accepts
// either the Mongo _id or the human-readable orderId (e.g. BF-20260903-00123)
// so links built from the latter — the eSewa callback redirect, the
// frontend's order-confirmation page — resolve correctly too.
const getOrderById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const order = mongoose.Types.ObjectId.isValid(id)
    ? await Order.findById(id)
    : await Order.findOne({ orderId: id });
  if (!order) {
    res.status(404);
    throw new Error('Order not found.');
  }
  if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    res.status(403);
    throw new Error('You are not authorized to view this order.');
  }
  res.json({ success: true, order });
});

// PATCH /api/orders/:id/cancel — customer self-service cancellation (Phase
// 9). Only the owner can cancel their own order (an admin has the separate,
// more permissive `PATCH /api/admin/orders/:id/status` endpoint), and only
// while it's still in `CUSTOMER_CANCELLABLE_STATUSES` — once fulfillment has
// actually started (Processing/Shipped/...), the shopper needs to contact
// support rather than self-cancel out from under a courier. Reuses exactly
// the same restock/refund bookkeeping `adminOrderController.updateOrderStatus`
// already applies when an admin cancels an order.
const cancelMyOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const order = mongoose.Types.ObjectId.isValid(id)
    ? await Order.findById(id)
    : await Order.findOne({ orderId: id });
  if (!order) {
    res.status(404);
    throw new Error('Order not found.');
  }
  if (order.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('You are not authorized to cancel this order.');
  }
  if (!CUSTOMER_CANCELLABLE_STATUSES.includes(order.orderStatus)) {
    res.status(400);
    throw new Error(
      `This order can no longer be cancelled — it is already ${order.orderStatus.toLowerCase()}. Please contact support if you need help.`
    );
  }

  const previousStatus = order.orderStatus;
  order.orderStatus = 'Cancelled';
  if (!order.statusHistory) order.statusHistory = [];
  order.statusHistory.push({ status: 'Cancelled', changedAt: new Date(), changedBy: 'customer' });

  await restockItems(Product, order.items);
  // Same reasoning adminOrderController.updateOrderStatus already applies:
  // a cancelled order was never fulfilled, so a Paid order becomes a refund
  // situation rather than a completed sale.
  if (order.paymentStatus === 'Paid') {
    order.paymentStatus = 'Refunded';
  }

  await order.save();

  emailService.sendOrderStatusUpdateEmail(order, previousStatus).catch(() => {});
  await notificationService.notifyOrderStatusChanged(Notification, order, previousStatus);

  res.json({ success: true, order });
});

module.exports = {
  createOrder,
  getMyOrders,
  getOrderById,
  cancelMyOrder,
  esewaSuccessCallback,
  esewaFailureCallback,
  checkEsewaStatus,
};
