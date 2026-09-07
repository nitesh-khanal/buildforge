// Pure, DB-free payment-status transition guard (Phase 9). Mirrors the
// transition guard adminOrderController.updateOrderStatus already applies to
// orderStatus (Delivered/Cancelled are terminal there) — before this,
// updatePaymentStatus accepted any enum value with no guard at all, so an
// admin could accidentally (or maliciously) move a fulfilled Paid/COD order
// back to Pending. See BUILD_FORGE_PROGRESS.md's "Known bugs" section.
//
// Rules:
// - A no-op (same status) is always allowed.
// - 'Refunded' is terminal — a refunded order's payment status never changes
//   again (matches the 'Delivered'/'Cancelled' orderStatus terminal pattern).
// - 'Paid' can only move to 'Refunded' — never back to 'Pending'/'Failed'/
//   'COD', which would misrepresent a completed sale as unpaid.
// - 'COD' (cash collected on delivery) can move to 'Paid' (reconciling that
//   cash was actually collected) or 'Refunded' (a returned COD order) — not
//   back to 'Pending'/'Failed'.
// - 'Pending' can move to 'Paid', 'Failed', or 'COD' (e.g. correcting a
//   mis-recorded payment method during support triage).
// - 'Failed' can move to 'Paid' (manual reconciliation after all) or back to
//   'Pending' (retrying payment) — not directly to 'Refunded', since nothing
//   was ever actually collected to refund.
const ALLOWED_PAYMENT_TRANSITIONS = {
  Pending: ['Paid', 'Failed', 'COD'],
  Paid: ['Refunded'],
  Failed: ['Paid', 'Pending'],
  COD: ['Paid', 'Refunded'],
  Refunded: [],
};

function isValidPaymentTransition(from, to) {
  if (from === to) return true;
  const allowed = ALLOWED_PAYMENT_TRANSITIONS[from];
  return Array.isArray(allowed) && allowed.includes(to);
}

module.exports = { ALLOWED_PAYMENT_TRANSITIONS, isValidPaymentTransition };
