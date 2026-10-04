const service = require('../services/khaltiService');
describe('Khalti checkout integrity', () => {
  const oldFetch = global.fetch;
  afterEach(() => { global.fetch = oldFetch; });
  it('converts the server total to integer paisa and rejects invalid amounts', () => {
    expect(service.amountPaisa(123.45)).toBe(12345);
    for (const n of [0, 9.99, NaN, 1.001]) expect(() => service.amountPaisa(n)).toThrow();
  });
  it('uses a local mock only outside production without merchant credentials', () => {
    expect(service.isLocalMock({ NODE_ENV: 'development' })).toBe(true);
    expect(service.isLocalMock({ NODE_ENV: 'production' })).toBe(false);
    expect(service.isLocalMock({ NODE_ENV: 'development', KHALTI_SECRET_KEY: 'test' })).toBe(false);
  });
  it('initiates a hosted sandbox payment with server-generated amount and order ID', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ pidx: 'p-1', payment_url: 'https://test-pay.khalti.com/?pidx=p-1' }) });
    const order = { orderId: 'BF-123', total: 125.5 };
    const result = await service.initiate(order, { backendUrl: 'https://shop.example.org', clientUrl: 'https://shop.example.org' }, { KHALTI_SECRET_KEY: 'test', KHALTI_TEST_MODE: 'true' });
    expect(result.pidx).toBe('p-1');
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('https://dev.khalti.com/api/v2/epayment/initiate/');
    expect(JSON.parse(options.body)).toMatchObject({ amount: 12550, purchase_order_id: 'BF-123', return_url: 'https://shop.example.org/api/orders/khalti/return' });
  });
  it('requires matching stored pidx, amount and completed status before payment', () => {
    const order = { total: 125.5, khaltiDetails: { pidx: 'p-1' } };
    const result = { pidx: 'p-1', amount: 12550, status: 'Completed', transactionId: 'txn', refunded: false };
    expect(service.matches(order, result)).toBe(true);
    for (const change of [{ pidx: 'other' }, { amount: 12549 }, { status: 'Pending' }, { transactionId: null }, { refunded: true }]) expect(service.matches(order, { ...result, ...change })).toBe(false);
  });
  it('rejects payment links outside Khalti', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ pidx: 'p-1', payment_url: 'https://evil.example/pay' }) });
    await expect(service.initiate({ orderId: 'BF-123', total: 100 }, { backendUrl: 'https://shop.example.org', clientUrl: 'https://shop.example.org' }, { KHALTI_SECRET_KEY: 'test' })).rejects.toThrow('invalid payment link');
  });
});
