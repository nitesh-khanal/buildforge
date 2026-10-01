const Order = require('../models/Order');
const { createOrder, esewaFailureCallback } = require('../controllers/orderController');
const { errorHandler } = require('../middleware/errorHandler');
function invoke(handler, req) {
  return new Promise((resolve) => {
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; },
      json(body) { resolve({ status: this.statusCode, body }); }, redirect(url) { resolve({ url }); } };
    handler(req, res, (err) => errorHandler(err, req, res, () => {}));
  });
}
const savedEnv = { ...process.env };
afterEach(() => { process.env = { ...savedEnv }; jest.restoreAllMocks(); });
it('cannot cancel a payment or restock inventory through an unsigned failure URL', async () => {
  const lookup = jest.spyOn(Order, 'findOne');
  const result = await invoke(esewaFailureCallback, { query: { transaction_uuid: 'BF-20260101-00001' } });
  expect(result.url).toContain('status=verification_error');
  expect(lookup).not.toHaveBeenCalled();
});
it('does not reflect arbitrary callback data into a redirect path', async () => {
  const result = await invoke(esewaFailureCallback, { query: { transaction_uuid: '//evil.example/?attack' } });
  expect(result.url).not.toContain('evil.example');
});
it('rejects demo card and disabled eSewa payments before creating an order in production', async () => {
  process.env.NODE_ENV = 'production'; process.env.CHECKOUT_ENABLED = 'true'; process.env.ESEWA_ENABLED = 'false';
  jest.spyOn(console, 'error').mockImplementation(() => {});
  for (const paymentMethod of ['card', 'esewa']) {
    const result = await invoke(createOrder, { body: { paymentMethod, shippingAddress: {} } });
    expect(result.status).toBe(400);
    expect(result.body.message).toContain('unavailable');
  }
});
it('returns a 400 for missing delivery details instead of an internal server error', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  const result = await invoke(createOrder, { body: { paymentMethod: 'cod', shippingAddress: {} } });
  expect(result.status).toBe(400);
  expect(result.body.message).toContain('Missing shipping');
});
it('keeps checkout closed until explicitly enabled', async () => {
  process.env.NODE_ENV = 'production'; process.env.CHECKOUT_ENABLED = 'false';
  jest.spyOn(console, 'error').mockImplementation(() => {});
  const result = await invoke(createOrder, { body: { paymentMethod: 'cod' } });
  expect(result.status).toBe(503);
});
