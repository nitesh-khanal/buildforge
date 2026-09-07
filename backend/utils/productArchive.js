// Pure, DB-free helpers for Phase 10's soft-delete/archive feature. Split out
// of adminProductController the same way utils/inventory.js/utils/delivery.js
// were split out of their controllers — directly unit-testable with zero
// mongoose dependency.

const STATUS_FILTERS = {
  active: { isArchived: { $ne: true } },
  archived: { isArchived: true },
  all: {},
};

// Turns the admin product list's `?status=` query param into a Mongo filter
// fragment. Defaults to 'all' (admins need to see archived products in order
// to restore them — unlike every *customer-facing* browsing surface, which
// always uses `Product.findActive` and never exposes this param at all).
// An unrecognized value falls back to 'all' rather than throwing, since this
// only ever narrows an admin listing, never a business-rule-critical path.
function buildAdminArchiveFilter(status) {
  return STATUS_FILTERS[status] || STATUS_FILTERS.all;
}

module.exports = { STATUS_FILTERS, buildAdminArchiveFilter };
