/**
 * Phase 9 — scheduled sweep for eSewa orders stuck `Pending` forever.
 *
 * Before this, an eSewa order only ever left `Pending` via the customer's
 * browser hitting the success/failure redirect, or someone manually calling
 * `GET /api/orders/:id/esewa-status`. If the customer closed the tab, lost
 * connectivity, or simply never came back, the order (and the stock it
 * reserved at checkout — see orderController.createOrder) sat in limbo
 * indefinitely. This module is called on an interval (wired up in
 * server.js) and, separately, from a manual admin-triggered endpoint
 * (`POST /api/admin/orders/sweep-esewa`) for on-demand reconciliation.
 *
 * Two thresholds, both configurable via env vars:
 *   - RECHECK_AFTER_MS: an order Pending for at least this long is worth
 *     asking eSewa's status API about again, in case it actually completed
 *     but the browser never made it back for the callback to fire.
 *   - EXPIRE_AFTER_MS: an order Pending for at least this long is expired
 *     outright — restocked and marked Failed — regardless of what eSewa's
 *     status API says (or even if it can no longer find the transaction at
 *     all), so reserved stock doesn't sit locked away forever.
 *
 * Dependencies (Order, Product, esewaService, restockItems,
 * notifyPaymentFailedInApp, Notification) are all passed in rather than
 * required at the top of the file — same dependency-injection shape as
 * utils/inventory.js's restockOrderItems(Product, items) and
 * ratingService.recalculateProductRating(Review, Product) — so the sweep
 * logic itself is exercisable in tests against fake models with zero live
 * DB or network dependency.
 */

const DEFAULT_RECHECK_AFTER_MINUTES = 15;
const DEFAULT_EXPIRE_AFTER_HOURS = 24;

function getRecheckAfterMs() {
  const minutes = Number(process.env.ESEWA_SWEEP_RECHECK_AFTER_MINUTES) || DEFAULT_RECHECK_AFTER_MINUTES;
  return minutes * 60 * 1000;
}

function getExpireAfterMs() {
  const hours = Number(process.env.ESEWA_SWEEP_EXPIRE_AFTER_HOURS) || DEFAULT_EXPIRE_AFTER_HOURS;
  return hours * 60 * 60 * 1000;
}

// Decides what to do with a single stale-pending order given eSewa's status
// check result (or null if the check itself failed/threw) and how old the
// order is. Pure decision logic, split out so it's unit-testable without a
// fake Mongoose document at all.
//   'finalize-paid'   — eSewa confirms it actually completed; mark Paid.
//   'expire'          — terminal eSewa status, or simply too old; restock
//                       and mark Failed.
//   'leave-pending'   — still genuinely pending and not old enough to expire
//                       yet; check again next sweep.
function decideAction({ statusCheckResult, ageMs, expireAfterMs }) {
  if (statusCheckResult && statusCheckResult.status === 'COMPLETE') {
    return 'finalize-paid';
  }
  if (statusCheckResult && ['CANCELED', 'NOT_FOUND', 'EXPIRED'].includes(statusCheckResult.status)) {
    return 'expire';
  }
  if (ageMs >= expireAfterMs) {
    return 'expire';
  }
  return 'leave-pending';
}

async function sweepStalePendingEsewaOrders({
  Order,
  Product,
  Notification,
  esewaService,
  restockOrderItems,
  orderNotificationService,
  notificationService,
  now = new Date(),
}) {
  const recheckAfterMs = getRecheckAfterMs();
  const expireAfterMs = getExpireAfterMs();

  const staleOrders = await Order.find({
    paymentMethod: 'esewa',
    paymentStatus: 'Pending',
    createdAt: { $lte: new Date(now.getTime() - recheckAfterMs) },
  });

  const summary = { checked: staleOrders.length, finalizedPaid: 0, expired: 0, leftPending: 0, errors: 0 };

  for (const order of staleOrders) {
    const ageMs = now.getTime() - order.createdAt.getTime();
    let statusCheckResult = null;
    try {
      statusCheckResult = await esewaService.checkTransactionStatus({
        transactionUuid: order.orderId,
        totalAmount: order.total,
      });
    } catch (err) {
      // A network hiccup or eSewa outage shouldn't itself expire the order —
      // fall through and let the age-based expiry decide instead.
      statusCheckResult = null;
    }

    const action = decideAction({ statusCheckResult, ageMs, expireAfterMs });

    try {
      if (action === 'finalize-paid') {
        order.paymentStatus = 'Paid';
        order.esewaDetails = {
          refId: statusCheckResult.ref_id,
          status: statusCheckResult.status,
          verifiedAt: now,
        };
        order.notifications = await orderNotificationService.notifyOrderConfirmed(order);
        await order.save();
        await notificationService.notifyPaymentSuccessful(Notification, order);
        summary.finalizedPaid += 1;
      } else if (action === 'expire') {
        order.paymentStatus = 'Failed';
        order.orderStatus = 'Cancelled';
        if (!order.statusHistory) order.statusHistory = [];
        order.statusHistory.push({ status: 'Cancelled', changedAt: now, changedBy: 'system' });
        await order.save();
        await restockOrderItems(Product, order.items);
        await notificationService.notifyPaymentFailedInApp(Notification, order);
        summary.expired += 1;
      } else {
        summary.leftPending += 1;
      }
    } catch (err) {
      summary.errors += 1;
    }
  }

  return summary;
}

module.exports = {
  decideAction,
  sweepStalePendingEsewaOrders,
  getRecheckAfterMs,
  getExpireAfterMs,
};
