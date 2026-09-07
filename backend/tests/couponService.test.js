const { getEligibleSubtotal, computeDiscountAmount, evaluateCoupon, collectReferencedProductIds } = require('../services/couponService');

const CPU_ID = '507f1f77bcf86cd799439011';
const GPU_ID = '507f1f77bcf86cd799439012';
const RAM_ID = '507f1f77bcf86cd799439013';

const baseItems = [
  { product: CPU_ID, price: 40000, quantity: 1, isCustomBuild: false },
  { product: GPU_ID, price: 100000, quantity: 1, isCustomBuild: false },
];

const productMap = new Map([
  [CPU_ID, { category: 'cpu' }],
  [GPU_ID, { category: 'gpu' }],
  [RAM_ID, { category: 'ram' }],
]);

function makeCoupon(overrides = {}) {
  return {
    code: 'SAVE10',
    discountType: 'percentage',
    discountValue: 10,
    minOrderAmount: 0,
    maxDiscountAmount: null,
    startDate: new Date('2026-01-01'),
    expiryDate: new Date('2026-12-31'),
    usageLimit: null,
    usageLimitPerUser: 1,
    isActive: true,
    applicableProducts: [],
    applicableCategories: [],
    ...overrides,
  };
}

describe('getEligibleSubtotal', () => {
  it('returns the full subtotal when the coupon has no restrictions', () => {
    expect(getEligibleSubtotal(baseItems, productMap, makeCoupon())).toBe(140000);
  });

  it('restricts to matching products only', () => {
    const coupon = makeCoupon({ applicableProducts: [CPU_ID] });
    expect(getEligibleSubtotal(baseItems, productMap, coupon)).toBe(40000);
  });

  it('restricts to matching categories only', () => {
    const coupon = makeCoupon({ applicableCategories: ['gpu'] });
    expect(getEligibleSubtotal(baseItems, productMap, coupon)).toBe(100000);
  });

  it('returns 0 when nothing in the cart matches the restriction', () => {
    const coupon = makeCoupon({ applicableCategories: ['ram'] });
    expect(getEligibleSubtotal(baseItems, productMap, coupon)).toBe(0);
  });

  it('checks custom-build components individually, scaled by build quantity', () => {
    const items = [
      {
        isCustomBuild: true,
        quantity: 2,
        buildComponents: [
          { product: CPU_ID, category: 'cpu', price: 40000 },
          { product: GPU_ID, category: 'gpu', price: 100000 },
        ],
      },
    ];
    const coupon = makeCoupon({ applicableCategories: ['gpu'] });
    expect(getEligibleSubtotal(items, productMap, coupon)).toBe(200000); // 100000 * 2 builds
  });
});

describe('computeDiscountAmount', () => {
  it('computes a plain percentage discount', () => {
    const coupon = makeCoupon({ discountType: 'percentage', discountValue: 10 });
    expect(computeDiscountAmount(coupon, 100000)).toBe(10000);
  });

  it('caps a percentage discount at maxDiscountAmount', () => {
    const coupon = makeCoupon({ discountType: 'percentage', discountValue: 50, maxDiscountAmount: 5000 });
    expect(computeDiscountAmount(coupon, 100000)).toBe(5000);
  });

  it('applies a fixed discount as-is when smaller than the eligible subtotal', () => {
    const coupon = makeCoupon({ discountType: 'fixed', discountValue: 2000 });
    expect(computeDiscountAmount(coupon, 100000)).toBe(2000);
  });

  it('never discounts more than the eligible subtotal itself', () => {
    const coupon = makeCoupon({ discountType: 'fixed', discountValue: 50000 });
    expect(computeDiscountAmount(coupon, 30000)).toBe(30000);
  });

  it('returns 0 for a zero or negative eligible subtotal', () => {
    const coupon = makeCoupon();
    expect(computeDiscountAmount(coupon, 0)).toBe(0);
  });

  it('rounds to the nearest whole rupee', () => {
    const coupon = makeCoupon({ discountType: 'percentage', discountValue: 33 });
    expect(computeDiscountAmount(coupon, 100)).toBe(33);
  });
});

describe('collectReferencedProductIds', () => {
  it('collects standalone item product ids', () => {
    expect(collectReferencedProductIds(baseItems).sort()).toEqual([CPU_ID, GPU_ID].sort());
  });

  it('collects custom-build component product ids, deduplicated', () => {
    const items = [
      { isCustomBuild: true, quantity: 1, buildComponents: [{ product: CPU_ID }, { product: GPU_ID }] },
      { product: CPU_ID, price: 1, quantity: 1, isCustomBuild: false },
    ];
    expect(collectReferencedProductIds(items).sort()).toEqual([CPU_ID, GPU_ID].sort());
  });
});

describe('evaluateCoupon', () => {
  const now = new Date('2026-06-01');

  it('accepts a valid unrestricted percentage coupon', () => {
    const result = evaluateCoupon({ coupon: makeCoupon(), items: baseItems, productMap, subtotal: 140000, now });
    expect(result.valid).toBe(true);
    expect(result.discount).toBe(14000);
  });

  it('rejects when the coupon is not found', () => {
    const result = evaluateCoupon({ coupon: null, items: baseItems, productMap, subtotal: 140000, now });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/not found/i);
  });

  it('rejects an inactive coupon', () => {
    const coupon = makeCoupon({ isActive: false });
    const result = evaluateCoupon({ coupon, items: baseItems, productMap, subtotal: 140000, now });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/no longer active/i);
  });

  it('rejects a coupon before its start date', () => {
    const coupon = makeCoupon({ startDate: new Date('2027-01-01') });
    const result = evaluateCoupon({ coupon, items: baseItems, productMap, subtotal: 140000, now });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/not active yet/i);
  });

  it('rejects an expired coupon', () => {
    const coupon = makeCoupon({ expiryDate: new Date('2026-01-01') });
    const result = evaluateCoupon({ coupon, items: baseItems, productMap, subtotal: 140000, now });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/expired/i);
  });

  it('rejects once the global usage limit is reached', () => {
    const coupon = makeCoupon({ usageLimit: 5 });
    const result = evaluateCoupon({
      coupon,
      items: baseItems,
      productMap,
      subtotal: 140000,
      globalUsageCount: 5,
      now,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/usage limit/i);
  });

  it('rejects once the per-user usage limit is reached', () => {
    const coupon = makeCoupon({ usageLimitPerUser: 1 });
    const result = evaluateCoupon({
      coupon,
      items: baseItems,
      productMap,
      subtotal: 140000,
      userUsageCount: 1,
      now,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/already used this coupon/i);
  });

  it('rejects when the cart subtotal is below minOrderAmount', () => {
    const coupon = makeCoupon({ minOrderAmount: 200000 });
    const result = evaluateCoupon({ coupon, items: baseItems, productMap, subtotal: 140000, now });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/minimum order/i);
  });

  it('rejects when no cart items are eligible under the restriction', () => {
    const coupon = makeCoupon({ applicableCategories: ['ram'] });
    const result = evaluateCoupon({ coupon, items: baseItems, productMap, subtotal: 140000, now });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/not eligible|none of the items/i);
  });

  it('computes the discount only against the eligible portion for a restricted coupon', () => {
    const coupon = makeCoupon({ applicableCategories: ['gpu'], discountType: 'fixed', discountValue: 5000 });
    const result = evaluateCoupon({ coupon, items: baseItems, productMap, subtotal: 140000, now });
    expect(result.valid).toBe(true);
    expect(result.discount).toBe(5000);
    expect(result.eligibleSubtotal).toBe(100000);
  });
});
