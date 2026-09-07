const {
  buildOrderPlacedNotification,
  buildPaymentSuccessfulNotification,
  buildPaymentFailedNotification,
  buildOrderStatusChangedNotification,
  writeNotification,
} = require('../services/notificationService');

const baseOrder = {
  orderId: 'BF-20260904-00001',
  total: 125000,
  paymentMethod: 'cod',
  paymentStatus: 'COD',
};

describe('buildOrderPlacedNotification', () => {
  it('mentions pay-on-delivery for COD orders', () => {
    const n = buildOrderPlacedNotification(baseOrder);
    expect(n.type).toBe('order_placed');
    expect(n.message).toMatch(/pay on delivery/i);
    expect(n.link).toBe('/orders/BF-20260904-00001');
  });

  it('tells esewa customers to complete payment', () => {
    const n = buildOrderPlacedNotification({ ...baseOrder, paymentMethod: 'esewa', paymentStatus: 'Pending' });
    expect(n.message).toMatch(/complete payment on eSewa/i);
  });

  it('confirms card orders as placed and paid when already Paid', () => {
    const n = buildOrderPlacedNotification({ ...baseOrder, paymentMethod: 'card', paymentStatus: 'Paid' });
    expect(n.message).toMatch(/placed and paid/i);
  });

  it('does not claim a card order is paid when it is not (defensive)', () => {
    const n = buildOrderPlacedNotification({ ...baseOrder, paymentMethod: 'card', paymentStatus: 'Pending' });
    expect(n.message).not.toMatch(/paid/i);
  });
});

describe('buildPaymentSuccessfulNotification', () => {
  it('includes the formatted total and order id', () => {
    const n = buildPaymentSuccessfulNotification(baseOrder);
    expect(n.type).toBe('payment_successful');
    expect(n.message).toContain('NPR 1,25,000');
    expect(n.message).toContain(baseOrder.orderId);
  });
});

describe('buildPaymentFailedNotification', () => {
  it('mentions cancellation and stock release', () => {
    const n = buildPaymentFailedNotification(baseOrder);
    expect(n.type).toBe('payment_failed');
    expect(n.message).toMatch(/cancelled/i);
    expect(n.message).toMatch(/stock released/i);
  });
});

describe('buildOrderStatusChangedNotification', () => {
  it('reports both the previous and new status', () => {
    const n = buildOrderStatusChangedNotification({ ...baseOrder, orderStatus: 'Shipped' }, 'Processing');
    expect(n.type).toBe('order_status_changed');
    expect(n.message).toContain('Shipped');
    expect(n.message).toContain('Processing');
    expect(n.data).toEqual({ orderId: baseOrder.orderId, previousStatus: 'Processing', orderStatus: 'Shipped' });
  });
});

describe('writeNotification', () => {
  it('returns null without calling create when there is no user id', async () => {
    const Notification = { create: jest.fn() };
    const result = await writeNotification(Notification, null, { type: 'order_placed' });
    expect(result).toBeNull();
    expect(Notification.create).not.toHaveBeenCalled();
  });

  it('is fail-soft: swallows a create() rejection and returns null', async () => {
    const Notification = { create: jest.fn().mockRejectedValue(new Error('db down')) };
    const result = await writeNotification(Notification, 'user123', { type: 'order_placed' });
    expect(result).toBeNull();
  });

  it('passes the userId and content through to create()', async () => {
    const created = { _id: 'n1' };
    const Notification = { create: jest.fn().mockResolvedValue(created) };
    const result = await writeNotification(Notification, 'user123', { type: 'order_placed', title: 'Order placed' });
    expect(Notification.create).toHaveBeenCalledWith({
      user: 'user123',
      type: 'order_placed',
      title: 'Order placed',
    });
    expect(result).toBe(created);
  });
});
