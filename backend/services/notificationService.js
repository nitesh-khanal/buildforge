/**
 * In-app notification center (Phase 4). Wires the `Notification` model
 * (Phase 1 foundation) up to the same lifecycle events that already trigger
 * emails (see services/orderNotificationService.js) so an order
 * confirmation, payment result, or status change becomes a bell-icon
 * notification too — not just an email.
 *
 * Unlike emailService/geminiService, this has no off-by-default env-var
 * gate: an in-app notification doesn't depend on any external service, so
 * there's nothing to misconfigure (see BUILD_FORGE_PROGRESS.md's Phase 4
 * scope note). It IS still fail-soft, though — a DB hiccup while writing a
 * notification must never undo or block the order/status change that
 * triggered it, same reasoning as the email/shipping side effects.
 *
 * Split into pure "builder" functions (content only, no DB — directly
 * unit-testable with zero mongoose dependency, same convention as
 * ratingService.computeRatingAggregate / compareUtils' pure functions) and
 * a thin DB-writing wrapper that takes the Notification model as a
 * parameter rather than require()-ing it — same dependency-injection shape
 * ratingService.recalculateProductRating uses for Review/Product.
 */

function nprLabel(n) {
  return `NPR ${Number(n).toLocaleString('en-IN')}`;
}

// Fired once per order, right after it's created — regardless of payment
// method or status. This is the "we got your order" moment; a separate
// payment_successful notification follows later for methods that don't
// confirm payment immediately (eSewa) or additionally confirm it up front
// (card).
function buildOrderPlacedNotification(order) {
  let message;
  if (order.paymentMethod === 'cod') {
    message = `Order ${order.orderId} placed — ${nprLabel(order.total)}, pay on delivery.`;
  } else if (order.paymentMethod === 'esewa') {
    message = `Order ${order.orderId} created — complete payment on eSewa to confirm it.`;
  } else {
    message =
      order.paymentStatus === 'Paid'
        ? `Order ${order.orderId} placed and paid — ${nprLabel(order.total)}.`
        : `Order ${order.orderId} placed — ${nprLabel(order.total)}.`;
  }
  return {
    type: 'order_placed',
    title: 'Order placed',
    message,
    link: `/orders/${order.orderId}`,
    data: { orderId: order.orderId },
  };
}

function buildPaymentSuccessfulNotification(order) {
  return {
    type: 'payment_successful',
    title: 'Payment received',
    message: `Payment of ${nprLabel(order.total)} confirmed for order ${order.orderId}.`,
    link: `/orders/${order.orderId}`,
    data: { orderId: order.orderId },
  };
}

function buildPaymentFailedNotification(order) {
  return {
    type: 'payment_failed',
    title: 'Payment failed',
    message: `Payment for order ${order.orderId} could not be completed. The order was cancelled and any reserved stock released.`,
    link: `/orders/${order.orderId}`,
    data: { orderId: order.orderId },
  };
}

function buildOrderStatusChangedNotification(order, previousStatus) {
  return {
    type: 'order_status_changed',
    title: 'Order update',
    message: `Order ${order.orderId} is now ${order.orderStatus} (was ${previousStatus}).`,
    link: `/orders/${order.orderId}`,
    data: { orderId: order.orderId, previousStatus, orderStatus: order.orderStatus },
  };
}

// DB-writing wrapper — never throws. Returns the created document, or null
// if writing failed (logged, not surfaced) or there's no user to notify
// (defensive only; every call site here always has one).
async function writeNotification(Notification, userId, content) {
  if (!userId) return null;
  try {
    return await Notification.create({ user: userId, ...content });
  } catch (err) {
    console.error('notificationService: failed to write notification:', err.message);
    return null;
  }
}

async function notifyOrderPlaced(Notification, order) {
  return writeNotification(Notification, order.user, buildOrderPlacedNotification(order));
}

async function notifyPaymentSuccessful(Notification, order) {
  return writeNotification(Notification, order.user, buildPaymentSuccessfulNotification(order));
}

async function notifyPaymentFailedInApp(Notification, order) {
  return writeNotification(Notification, order.user, buildPaymentFailedNotification(order));
}

async function notifyOrderStatusChanged(Notification, order, previousStatus) {
  return writeNotification(Notification, order.user, buildOrderStatusChangedNotification(order, previousStatus));
}

module.exports = {
  buildOrderPlacedNotification,
  buildPaymentSuccessfulNotification,
  buildPaymentFailedNotification,
  buildOrderStatusChangedNotification,
  writeNotification,
  notifyOrderPlaced,
  notifyPaymentSuccessful,
  notifyPaymentFailedInApp,
  notifyOrderStatusChanged,
};
