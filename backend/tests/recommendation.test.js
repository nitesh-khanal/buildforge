const {
  similarProducts,
  frequentlyBoughtWith,
  filterCompatibleForSlot,
  rankCandidates,
  buildHistoryProfile,
  personalizedForUser,
} = require('../services/recommendationService');

// Minimal fake "Product" objects — same approach as compatibility.test.js.
const cpuA = { _id: 'cpu-a', name: 'Ryzen 5 7600X', category: 'cpu', brand: 'AMD', price: 42000, rating: 4.6, isFeatured: true, compatibilityData: { socket: 'AM5', tdp: 105 } };
const cpuB = { _id: 'cpu-b', name: 'Ryzen 7 7700X', category: 'cpu', brand: 'AMD', price: 45000, rating: 4.4, compatibilityData: { socket: 'AM5', tdp: 105 } };
const cpuFar = { _id: 'cpu-far', name: 'Ryzen 9 7950X', category: 'cpu', brand: 'AMD', price: 95000, rating: 4.8, compatibilityData: { socket: 'AM5', tdp: 170 } };

const moboAM5 = { _id: 'mobo-am5', name: 'B650-Plus', category: 'motherboard', brand: 'MSI', price: 32000, rating: 4.5, compatibilityData: { socket: 'AM5', formFactor: 'ATX', ramType: 'DDR5', maxRam: 128 } };
const moboLGA = { _id: 'mobo-lga', name: 'Z790', category: 'motherboard', brand: 'MSI', price: 38000, rating: 4.7, isFeatured: true, compatibilityData: { socket: 'LGA1700', formFactor: 'ATX', ramType: 'DDR5', maxRam: 128 } };
const moboLowRated = { _id: 'mobo-low', name: 'A620', category: 'motherboard', brand: 'Asus', price: 18000, rating: 3.9, compatibilityData: { socket: 'AM5', formFactor: 'ATX', ramType: 'DDR5', maxRam: 64 } };

const cooler = { _id: 'cooler-1', name: 'Hyper 212', category: 'cpu-cooler', brand: 'Cooler Master', price: 4200, rating: 4.5, compatibilityData: { supportedSockets: ['AM5', 'LGA1700'], height: 159, tdpRating: 150 } };

describe('recommendationService', () => {
  describe('similarProducts', () => {
    it('excludes the product itself and anything outside the price band', () => {
      const pool = [cpuA, cpuB, cpuFar];
      const results = similarProducts(cpuA, pool, { limit: 5 });
      const ids = results.map((p) => p._id);
      expect(ids).not.toContain('cpu-a');
      expect(ids).toContain('cpu-b');
      expect(ids).not.toContain('cpu-far'); // 95000 is far outside the 35% band around 42000
    });

    it('ranks by featured then rating', () => {
      const results = similarProducts(cpuA, [cpuB], { limit: 5 });
      expect(results[0]._id).toBe('cpu-b');
    });
  });

  describe('frequentlyBoughtWith', () => {
    it('returns top picks for each related category', () => {
      const pools = { motherboard: [moboAM5, moboLowRated], 'cpu-cooler': [cooler] };
      const result = frequentlyBoughtWith(cpuA, pools, { limitPerCategory: 2 });
      expect(result.motherboard[0]._id).toBe('mobo-am5'); // higher rating
      expect(result['cpu-cooler'][0]._id).toBe('cooler-1');
    });

    it('returns an empty object for a category with no pairings', () => {
      const storageProduct = { _id: 's1', category: 'storage', price: 5000, rating: 4 };
      const result = frequentlyBoughtWith(storageProduct, {});
      expect(result).toEqual({});
    });
  });

  describe('filterCompatibleForSlot + rankCandidates', () => {
    it('filters out sockets that would introduce a compatibility error', () => {
      const selected = { cpu: cpuA }; // AM5
      const entries = filterCompatibleForSlot('motherboard', [moboAM5, moboLGA, moboLowRated], selected);
      const ids = entries.map((e) => e.product._id);
      expect(ids).toContain('mobo-am5');
      expect(ids).toContain('mobo-low');
      expect(ids).not.toContain('mobo-lga'); // socket mismatch would be an error
    });

    it('ranks filtered candidates by rating, penalizing over-budget picks', () => {
      const selected = { cpu: cpuA };
      const entries = filterCompatibleForSlot('motherboard', [moboAM5, moboLowRated], selected);
      const ranked = rankCandidates(entries, { limit: 2, budgetRemaining: 20000 });
      // mobo-am5 has the higher rating but is over the 20000 budget, so the
      // cheaper, in-budget mobo-low should win the top slot.
      expect(ranked[0].product._id).toBe('mobo-low');
    });

    it('passes categories with no modeled constraints straight through', () => {
      const entries = filterCompatibleForSlot('storage', [{ _id: 'ssd-1', price: 5000, rating: 4.2 }], {});
      expect(entries).toHaveLength(1);
      expect(entries[0].issues).toEqual([]);
    });
  });

  describe('buildHistoryProfile', () => {
    it('tallies categories/brands from both regular items and custom builds', () => {
      const orders = [
        {
          items: [
            { isCustomBuild: false, product: { _id: 'p1', category: 'gpu', brand: 'NVIDIA' } },
            {
              isCustomBuild: true,
              buildComponents: [
                { category: 'cpu', product: { _id: 'p2', brand: 'AMD' } },
                { category: 'motherboard', product: { _id: 'p3', brand: 'MSI' } },
              ],
            },
          ],
        },
      ];
      const profile = buildHistoryProfile(orders);
      expect(profile.categoryCounts).toEqual({ gpu: 1, cpu: 1, motherboard: 1 });
      expect(profile.brandCounts).toEqual({ NVIDIA: 1, AMD: 1, MSI: 1 });
      expect(profile.purchasedProductIds.sort()).toEqual(['p1', 'p2', 'p3']);
    });
  });

  describe('personalizedForUser', () => {
    it('ranks products matching the user\'s category/brand history higher', () => {
      const profile = { categoryCounts: { gpu: 3 }, brandCounts: { NVIDIA: 2 } };
      const pool = [
        { _id: 'gpu-nvidia', category: 'gpu', brand: 'NVIDIA', rating: 4.0 },
        { _id: 'ram-1', category: 'ram', brand: 'Corsair', rating: 4.9 },
      ];
      const results = personalizedForUser(profile, pool, { limit: 2 });
      expect(results[0]._id).toBe('gpu-nvidia'); // category+brand affinity outweighs raw rating
    });
  });
});
