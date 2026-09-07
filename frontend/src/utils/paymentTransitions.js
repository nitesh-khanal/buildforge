// Frontend mirror of backend/utils/paymentTransitions.js (Phase 10). This is
// a deliberate, small, intentional duplication — flagged as a known
// trade-off in BUILD_FORGE_PROGRESS.md's "Known bugs" section (previously
// deferred to Phase 11, pulled forward into Phase 10 since the table is
// tiny and static). The backend's `isValidPaymentTransition` remains
// authoritative and re-checks every request regardless — this only drives
// which options the admin's dropdown *offers*, so a stale copy here would
// at worst show an option that the backend then correctly rejects with a
// 400, never the other way around. If the backend table ever changes,
// this one must be updated to match by hand.
const ALLOWED_PAYMENT_TRANSITIONS = {
  Pending: ['Paid', 'Failed', 'COD'],
  Paid: ['Refunded'],
  Failed: ['Paid', 'Pending'],
  COD: ['Paid', 'Refunded'],
  Refunded: [],
};

// Returns the list of payment statuses selectable from `current`, including
// `current` itself (so the dropdown always has the order's existing value
// as an option, matching how the order-status dropdown already behaves).
export function getSelectablePaymentStatuses(current) {
  const allowed = ALLOWED_PAYMENT_TRANSITIONS[current] || [];
  return [current, ...allowed];
}
