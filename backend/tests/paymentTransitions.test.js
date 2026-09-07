const { isValidPaymentTransition } = require('../utils/paymentTransitions');

// Phase 9 regression tests for the "no transition guard on payment status"
// bug: adminOrderController.updatePaymentStatus used to accept any enum
// value, including reverting a fulfilled Paid/COD order back to Pending.

describe('isValidPaymentTransition', () => {
  it('always allows a no-op (same status to itself)', () => {
    ['Pending', 'Paid', 'Failed', 'COD', 'Refunded'].forEach((s) => {
      expect(isValidPaymentTransition(s, s)).toBe(true);
    });
  });

  it('allows Pending to move to Paid, Failed, or COD', () => {
    expect(isValidPaymentTransition('Pending', 'Paid')).toBe(true);
    expect(isValidPaymentTransition('Pending', 'Failed')).toBe(true);
    expect(isValidPaymentTransition('Pending', 'COD')).toBe(true);
  });

  it('blocks Paid from reverting to Pending or Failed', () => {
    expect(isValidPaymentTransition('Paid', 'Pending')).toBe(false);
    expect(isValidPaymentTransition('Paid', 'Failed')).toBe(false);
  });

  it('allows Paid to move to Refunded', () => {
    expect(isValidPaymentTransition('Paid', 'Refunded')).toBe(true);
  });

  it('allows COD to move to Paid or Refunded but not back to Pending/Failed', () => {
    expect(isValidPaymentTransition('COD', 'Paid')).toBe(true);
    expect(isValidPaymentTransition('COD', 'Refunded')).toBe(true);
    expect(isValidPaymentTransition('COD', 'Pending')).toBe(false);
    expect(isValidPaymentTransition('COD', 'Failed')).toBe(false);
  });

  it('allows Failed to move to Paid or Pending but not directly to Refunded', () => {
    expect(isValidPaymentTransition('Failed', 'Paid')).toBe(true);
    expect(isValidPaymentTransition('Failed', 'Pending')).toBe(true);
    expect(isValidPaymentTransition('Failed', 'Refunded')).toBe(false);
  });

  it('treats Refunded as terminal', () => {
    expect(isValidPaymentTransition('Refunded', 'Paid')).toBe(false);
    expect(isValidPaymentTransition('Refunded', 'Pending')).toBe(false);
    expect(isValidPaymentTransition('Refunded', 'COD')).toBe(false);
    expect(isValidPaymentTransition('Refunded', 'Failed')).toBe(false);
  });
});
