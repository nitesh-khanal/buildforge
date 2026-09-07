// Pure, DB-free cart-merge logic — pulled out of authController.mergeGuestCart
// (Phase 9) so it's directly unit-testable, same convention as
// utils/inventory.js's flattenStockRequirements.
//
// Bug being fixed (see BUILD_FORGE_PROGRESS.md's "Known bugs" section): the
// original merge simply concatenated the guest cart's items onto the user's
// cart array, so a product already present in both carts ended up as two
// separate line items instead of one line item with a summed quantity.
//
// Custom-build items are never merged into one another — each saved build is
// its own line item (matches cartController.addCustomBuild's own behavior,
// which never looks for an "existing" custom build to add onto) — they are
// always appended as-is, same as any standalone product that has no match in
// the other cart.

function isStandalone(item) {
  return !item.isCustomBuild && item.product;
}

function productKey(item) {
  return item.product.toString();
}

// mergeCartItems(userItems, guestItems, stockByProductId?) -> merged items
// stockByProductId (optional): Map<productId string, number> — when
// provided, a merged standalone line's quantity is capped at the product's
// current stock rather than allowed to exceed it (mirrors the same cap
// cartController.addItem already applies when adding a single item).
function mergeCartItems(userItems, guestItems, stockByProductId) {
  const merged = userItems.map((item) => (item.toObject ? item.toObject() : { ...item }));

  for (const rawGuestItem of guestItems) {
    const guestItem = rawGuestItem.toObject ? rawGuestItem.toObject() : { ...rawGuestItem };

    if (isStandalone(guestItem)) {
      const key = productKey(guestItem);
      const existing = merged.find((i) => isStandalone(i) && productKey(i) === key);
      if (existing) {
        let summed = existing.quantity + guestItem.quantity;
        if (stockByProductId && stockByProductId.has(key)) {
          summed = Math.min(summed, stockByProductId.get(key));
        }
        existing.quantity = summed;
        continue;
      }
    }

    // No match (or it's a custom build) — append as its own line item.
    merged.push(guestItem);
  }

  return merged;
}

module.exports = { mergeCartItems };
