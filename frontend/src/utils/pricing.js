// Mirrors backend/controllers/orderController.js (SHIPPING_COST,
// FREE_SHIPPING_THRESHOLD). Display-only — the backend always recomputes
// and returns the authoritative shippingCost/total on the created order,
// so a mismatch here can never under/overcharge anyone.
export const SHIPPING_COST = 300;
export const FREE_SHIPPING_THRESHOLD = 100000;
