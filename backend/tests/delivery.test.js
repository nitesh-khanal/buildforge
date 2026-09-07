const { addBusinessDays, estimateDeliveryDate } = require('../utils/delivery');

describe('addBusinessDays', () => {
  it('adds calendar days when no weekend is crossed', () => {
    // Monday 2026-09-07 + 3 business days -> Thursday 2026-09-10
    const result = addBusinessDays(new Date('2026-09-07T00:00:00Z'), 3);
    expect(result.getUTCDay()).toBe(4); // Thursday
    expect(result.getUTCDate()).toBe(10);
  });

  it('skips weekends', () => {
    // Friday 2026-09-04 + 1 business day -> Monday 2026-09-07 (skips Sat/Sun)
    const result = addBusinessDays(new Date('2026-09-04T00:00:00Z'), 1);
    expect(result.getUTCDay()).toBe(1); // Monday
    expect(result.getUTCDate()).toBe(7);
  });
});

describe('estimateDeliveryDate', () => {
  it('adds the standard transit time for card/esewa orders', () => {
    const orderDate = new Date('2026-09-07T00:00:00Z'); // Monday
    const est = estimateDeliveryDate(orderDate, { paymentMethod: 'card' });
    // 5 business days from Monday -> the following Monday
    expect(est.getUTCDay()).toBe(1);
    expect(est.getTime()).toBeGreaterThan(orderDate.getTime());
  });

  it('adds an extra day of transit time for COD orders', () => {
    const orderDate = new Date('2026-09-07T00:00:00Z');
    const standardEst = estimateDeliveryDate(orderDate, { paymentMethod: 'card' });
    const codEst = estimateDeliveryDate(orderDate, { paymentMethod: 'cod' });
    expect(codEst.getTime()).toBeGreaterThan(standardEst.getTime());
  });
});
