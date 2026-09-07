const { flattenStockRequirements, restockOrderItems } = require('../utils/inventory');

// flattenStockRequirements is pure (no DB), so it's tested directly.
// restockOrderItems is tested with a fake "Product" model whose bulkWrite
// just records what it was called with, matching the fake-model style
// compatibilityService/recommendationService tests already use elsewhere.

describe('inventory helpers', () => {
  describe('flattenStockRequirements', () => {
    it('counts a simple standalone item by product id and quantity', () => {
      const items = [{ product: 'p1', quantity: 2 }];
      const reqs = flattenStockRequirements(items);
      expect(reqs.get('p1')).toBe(2);
    });

    it('expands a custom build into one unit per component, per build quantity', () => {
      const items = [
        {
          isCustomBuild: true,
          quantity: 2,
          buildComponents: [{ product: 'cpu1' }, { product: 'gpu1' }],
        },
      ];
      const reqs = flattenStockRequirements(items);
      expect(reqs.get('cpu1')).toBe(2);
      expect(reqs.get('gpu1')).toBe(2);
    });

    it('merges quantities when the same product appears standalone and inside a build', () => {
      const items = [
        { product: 'ram1', quantity: 1 },
        {
          isCustomBuild: true,
          quantity: 1,
          buildComponents: [{ product: 'ram1' }],
        },
      ];
      const reqs = flattenStockRequirements(items);
      expect(reqs.get('ram1')).toBe(2);
    });

    it('ignores an item with no product reference (e.g. a legacy/incomplete row)', () => {
      const items = [{ quantity: 3 }];
      const reqs = flattenStockRequirements(items);
      expect(reqs.size).toBe(0);
    });
  });

  describe('restockOrderItems', () => {
    it('issues one bulkWrite $inc op per distinct product', async () => {
      const calls = [];
      const FakeProduct = { bulkWrite: async (ops) => calls.push(ops) };

      const items = [
        { product: 'p1', quantity: 2 },
        {
          isCustomBuild: true,
          quantity: 1,
          buildComponents: [{ product: 'p2' }, { product: 'p1' }],
        },
      ];

      await restockOrderItems(FakeProduct, items);

      expect(calls).toHaveLength(1);
      const ops = calls[0];
      const byId = Object.fromEntries(
        ops.map((op) => [op.updateOne.filter._id, op.updateOne.update.$inc.stock])
      );
      expect(byId.p1).toBe(3); // 2 standalone + 1 from the build
      expect(byId.p2).toBe(1);
    });

    it('does not call bulkWrite at all when there is nothing to restock', async () => {
      let called = false;
      const FakeProduct = { bulkWrite: async () => (called = true) };
      await restockOrderItems(FakeProduct, []);
      expect(called).toBe(false);
    });
  });
});
