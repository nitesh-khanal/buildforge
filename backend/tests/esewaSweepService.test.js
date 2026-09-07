const { decideAction, sweepStalePendingEsewaOrders } = require('../services/esewaSweepService');

describe('decideAction (pure)', () => {
  const expireAfterMs = 24 * 60 * 60 * 1000;

  it('finalizes as paid when eSewa reports COMPLETE', () => {
    const action = decideAction({ statusCheckResult: { status: 'COMPLETE' }, ageMs: 1000, expireAfterMs });
    expect(action).toBe('finalize-paid');
  });

  it('expires when eSewa reports a terminal failure status', () => {
    ['CANCELED', 'NOT_FOUND', 'EXPIRED'].forEach((status) => {
      const action = decideAction({ statusCheckResult: { status }, ageMs: 1000, expireAfterMs });
      expect(action).toBe('expire');
    });
  });

  it('expires once the order is older than the hard expiry window, even with no status result', () => {
    const action = decideAction({ statusCheckResult: null, ageMs: expireAfterMs + 1, expireAfterMs });
    expect(action).toBe('expire');
  });

  it('leaves it pending when still genuinely pending and not yet old enough to expire', () => {
    const action = decideAction({ statusCheckResult: { status: 'PENDING' }, ageMs: 1000, expireAfterMs });
    expect(action).toBe('leave-pending');
  });
});

// Fake-model style exercise of the full sweep, same convention as
// tests/inventory.test.js's restockOrderItems tests — a minimal fake
// Order/Product/Notification/service set that records what it was called
// with, no real Mongoose or network dependency.
describe('sweepStalePendingEsewaOrders (fake models)', () => {
  function makeOrder(overrides = {}) {
    return {
      orderId: 'BF-TEST-1',
      total: 1000,
      paymentStatus: 'Pending',
      orderStatus: 'Pending',
      createdAt: new Date(Date.now() - 60 * 60 * 1000),
      items: [{ product: 'p1', quantity: 1 }],
      statusHistory: [],
      save: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    };
  }

  it('finalizes a stale order that eSewa confirms actually completed', async () => {
    const order = makeOrder();
    const Order = { find: jest.fn().mockResolvedValue([order]) };
    const Product = {};
    const Notification = {};
    const esewaService = {
      checkTransactionStatus: jest.fn().mockResolvedValue({ status: 'COMPLETE', ref_id: 'REF1' }),
    };
    const restockOrderItems = jest.fn().mockResolvedValue(undefined);
    const orderNotificationService = { notifyOrderConfirmed: jest.fn().mockResolvedValue({ confirmationEmailSent: true }) };
    const notificationService = {
      notifyPaymentSuccessful: jest.fn().mockResolvedValue(undefined),
      notifyPaymentFailedInApp: jest.fn().mockResolvedValue(undefined),
    };

    const summary = await sweepStalePendingEsewaOrders({
      Order,
      Product,
      Notification,
      esewaService,
      restockOrderItems,
      orderNotificationService,
      notificationService,
    });

    expect(order.paymentStatus).toBe('Paid');
    expect(order.save).toHaveBeenCalled();
    expect(restockOrderItems).not.toHaveBeenCalled();
    expect(summary).toEqual({ checked: 1, finalizedPaid: 1, expired: 0, leftPending: 0, errors: 0 });
  });

  it('expires and restocks a stale order eSewa reports as CANCELED', async () => {
    const order = makeOrder();
    const Order = { find: jest.fn().mockResolvedValue([order]) };
    const Product = {};
    const Notification = {};
    const esewaService = {
      checkTransactionStatus: jest.fn().mockResolvedValue({ status: 'CANCELED' }),
    };
    const restockOrderItems = jest.fn().mockResolvedValue(undefined);
    const orderNotificationService = { notifyOrderConfirmed: jest.fn() };
    const notificationService = {
      notifyPaymentSuccessful: jest.fn(),
      notifyPaymentFailedInApp: jest.fn().mockResolvedValue(undefined),
    };

    const summary = await sweepStalePendingEsewaOrders({
      Order,
      Product,
      Notification,
      esewaService,
      restockOrderItems,
      orderNotificationService,
      notificationService,
    });

    expect(order.paymentStatus).toBe('Failed');
    expect(order.orderStatus).toBe('Cancelled');
    expect(restockOrderItems).toHaveBeenCalledWith(Product, order.items);
    expect(summary.expired).toBe(1);
  });

  it('leaves a genuinely still-pending, not-yet-expired order untouched', async () => {
    const order = makeOrder();
    const Order = { find: jest.fn().mockResolvedValue([order]) };
    const esewaService = { checkTransactionStatus: jest.fn().mockResolvedValue({ status: 'PENDING' }) };
    const restockOrderItems = jest.fn();
    const orderNotificationService = { notifyOrderConfirmed: jest.fn() };
    const notificationService = { notifyPaymentSuccessful: jest.fn(), notifyPaymentFailedInApp: jest.fn() };

    const summary = await sweepStalePendingEsewaOrders({
      Order,
      Product: {},
      Notification: {},
      esewaService,
      restockOrderItems,
      orderNotificationService,
      notificationService,
    });

    expect(order.save).not.toHaveBeenCalled();
    expect(summary.leftPending).toBe(1);
  });

  it('does not let a failed status check itself crash the sweep, and still expires very old orders', async () => {
    const order = makeOrder({ createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) });
    const Order = { find: jest.fn().mockResolvedValue([order]) };
    const esewaService = { checkTransactionStatus: jest.fn().mockRejectedValue(new Error('network down')) };
    const restockOrderItems = jest.fn().mockResolvedValue(undefined);
    const orderNotificationService = { notifyOrderConfirmed: jest.fn() };
    const notificationService = { notifyPaymentSuccessful: jest.fn(), notifyPaymentFailedInApp: jest.fn().mockResolvedValue(undefined) };

    const summary = await sweepStalePendingEsewaOrders({
      Order,
      Product: {},
      Notification: {},
      esewaService,
      restockOrderItems,
      orderNotificationService,
      notificationService,
    });

    expect(order.paymentStatus).toBe('Failed');
    expect(summary.expired).toBe(1);
    expect(summary.errors).toBe(0);
  });
});
