const Counter = require('../models/Counter');

// Generates BF-YYYYMMDD-00123 style IDs using an atomic per-day counter so
// concurrent checkouts never collide.
async function generateOrderId() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const dateStr = `${y}${m}${d}`;
  const counterId = `orders-${dateStr}`;

  const counter = await Counter.findByIdAndUpdate(
    counterId,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const seqStr = String(counter.seq).padStart(5, '0');
  return `BF-${dateStr}-${seqStr}`;
}

module.exports = generateOrderId;
