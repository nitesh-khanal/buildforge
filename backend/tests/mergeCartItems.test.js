const { mergeCartItems } = require('../utils/mergeCartItems');

// Phase 9 regression tests for the guest-cart-merge bug documented in
// BUILD_FORGE_PROGRESS.md: merging used to concatenate items instead of
// summing quantities for a product already present in both carts.

describe('mergeCartItems', () => {
  it('sums quantities when the same standalone product exists in both carts', () => {
    const userItems = [{ product: 'p1', name: 'CPU', price: 100, quantity: 1, isCustomBuild: false }];
    const guestItems = [{ product: 'p1', name: 'CPU', price: 100, quantity: 2, isCustomBuild: false }];

    const merged = mergeCartItems(userItems, guestItems);

    expect(merged).toHaveLength(1);
    expect(merged[0].quantity).toBe(3);
  });

  it('appends a guest item with no matching product as its own line', () => {
    const userItems = [{ product: 'p1', quantity: 1, isCustomBuild: false }];
    const guestItems = [{ product: 'p2', quantity: 1, isCustomBuild: false }];

    const merged = mergeCartItems(userItems, guestItems);

    expect(merged).toHaveLength(2);
    expect(merged.map((i) => i.product)).toEqual(expect.arrayContaining(['p1', 'p2']));
  });

  it('never merges custom-build items into one another or into a standalone item', () => {
    const userItems = [{ product: 'p1', quantity: 1, isCustomBuild: false }];
    const guestItems = [
      { isCustomBuild: true, quantity: 1, buildComponents: [{ product: 'cpu1' }] },
      { isCustomBuild: true, quantity: 1, buildComponents: [{ product: 'cpu1' }] },
    ];

    const merged = mergeCartItems(userItems, guestItems);

    expect(merged).toHaveLength(3);
    expect(merged.filter((i) => i.isCustomBuild)).toHaveLength(2);
  });

  it('caps a merged quantity at the product\'s current stock when a stock map is supplied', () => {
    const userItems = [{ product: 'p1', quantity: 3, isCustomBuild: false }];
    const guestItems = [{ product: 'p1', quantity: 3, isCustomBuild: false }];
    const stockByProductId = new Map([['p1', 4]]);

    const merged = mergeCartItems(userItems, guestItems, stockByProductId);

    expect(merged).toHaveLength(1);
    expect(merged[0].quantity).toBe(4);
  });

  it('leaves an empty guest cart producing an unchanged user cart', () => {
    const userItems = [{ product: 'p1', quantity: 1, isCustomBuild: false }];
    const merged = mergeCartItems(userItems, []);
    expect(merged).toHaveLength(1);
    expect(merged[0].quantity).toBe(1);
  });
});
