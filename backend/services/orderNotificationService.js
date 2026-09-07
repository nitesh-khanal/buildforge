/**
 * Fires the two Phase 5 side effects that should happen once an order is
 * actually confirmed (COD placed, card charged, or an eSewa callback
 * verified as COMPLETE) — never while paymentStatus is still Pending:
 *
 *   1. order-confirmation email to the customer
 *   2. shipping-partner handoff (email + WhatsApp click-to-chat link)
 *
 * Both underlying services are off-by-default and fail soft, so this never
 * throws — a missing SMTP config or a flaky send should never undo an
 * order that was already correctly created and paid for. Results are
 * persisted onto the order (idempotency flags + the WhatsApp link so the
 * frontend/admin can render a "message shipping partner" button) via a
 * caller-supplied save function, since this file has no direct DB
 * dependency of its own.
 */

const emailService = require('./emailService');
const shippingNotificationService = require('./shippingNotificationService');

// order: a Mongoose Order document (or plain object with the same shape).
// Returns the notification outcome; does not save — the caller decides how
// (e.g. `order.notifications = result; await order.save()`).
async function notifyOrderConfirmed(order) {
  if (order.notifications && order.notifications.confirmationEmailSent) {
    // Already notified once (e.g. a duplicate eSewa callback) — don't spam.
    return order.notifications;
  }

  const [emailResult, shippingResult] = await Promise.all([
    emailService.sendOrderConfirmationEmail(order),
    shippingNotificationService.notifyShippingPartner(order),
  ]);

  return {
    confirmationEmailSent: emailResult.sent,
    shippingPartnerEmailSent: shippingResult.emailSent,
    shippingWhatsappLink: shippingResult.whatsappLink || null,
    notifiedAt: new Date(),
  };
}

// Fired when an eSewa redirect (or status check) comes back as a failure —
// releases the customer from limbo without touching the shipping partner.
async function notifyPaymentFailed(order) {
  const emailResult = await emailService.sendPaymentFailedEmail(order);
  return { failureEmailSent: emailResult.sent };
}

module.exports = { notifyOrderConfirmed, notifyPaymentFailed };
