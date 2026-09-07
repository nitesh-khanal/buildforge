// Pure, DB-free delivery-estimate helper (Phase 9). BuildForge has no real
// courier integration (shippingNotificationService.js's own comment already
// documents this — a wa.me link, not a courier API), so there is no live
// tracking data to show a customer. What we *can* give them is a plain
// estimated delivery date computed at order-placement time, shown on the
// order confirmation/detail pages alongside the existing status timeline.

const STANDARD_TRANSIT_DAYS = 5; // business days, door-to-door, flat rate
const COD_EXTRA_DAYS = 1; // COD orders route through an extra verification step

// Adds `days` business days (Mon-Fri) to `date`, skipping weekends.
function addBusinessDays(date, days) {
  const result = new Date(date.getTime());
  let remaining = days;
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay(); // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      remaining -= 1;
    }
  }
  return result;
}

// estimateDeliveryDate(orderDate, { paymentMethod }) -> Date
function estimateDeliveryDate(orderDate, { paymentMethod } = {}) {
  const transitDays = STANDARD_TRANSIT_DAYS + (paymentMethod === 'cod' ? COD_EXTRA_DAYS : 0);
  return addBusinessDays(orderDate, transitDays);
}

module.exports = { addBusinessDays, estimateDeliveryDate, STANDARD_TRANSIT_DAYS, COD_EXTRA_DAYS };
