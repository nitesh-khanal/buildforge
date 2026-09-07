// Shared stock-accounting helpers. Originally lived inline in
// orderController.js (Phase 2/5); pulled out here in Phase 6 so
// adminOrderController can reuse the exact same restock logic when an
// admin cancels an order, instead of duplicating it.

// Expands a list of order/cart items into a flat Map of productId -> qty
// needed. A custom build's components each need exactly 1 unit accounted
// for per build quantity ordered.
function flattenStockRequirements(items) {
  const requirements = new Map();
  for (const item of items) {
    if (item.isCustomBuild) {
      for (const comp of item.buildComponents) {
        const key = comp.product.toString();
        requirements.set(key, (requirements.get(key) || 0) + item.quantity);
      }
    } else if (item.product) {
      const key = item.product.toString();
      requirements.set(key, (requirements.get(key) || 0) + item.quantity);
    }
  }
  return requirements;
}

// Reverses the inventory decrement done at order-creation time — used when
// an eSewa payment fails/expires after checkout already reserved stock, and
// when an admin cancels an order that was never fulfilled.
async function restockOrderItems(Product, items) {
  const requirements = flattenStockRequirements(items);
  const ops = [...requirements].map(([productId, qty]) => ({
    updateOne: { filter: { _id: productId }, update: { $inc: { stock: qty } } },
  }));
  if (ops.length) await Product.bulkWrite(ops);
}

module.exports = { flattenStockRequirements, restockOrderItems };
