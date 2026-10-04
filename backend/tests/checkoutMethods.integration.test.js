process.env.JWT_SECRET = 'test-checkout-methods-secret-not-for-production';
const mongoose = require('mongoose');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const Product = require('../models/Product');
const User = require('../models/User');
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const assertTestDatabase = require('../utils/testDatabase');
let user, product, token;
const shippingAddress = { fullName: 'Test Customer', email: 'checkout-methods@buildforge.test', phone: '9800000000', address: 'Test Lane', city: 'Kathmandu', province: 'Bagmati' };
const auth = () => ({ Authorization: `Bearer ${token}` });
async function addCart() {
  await Cart.findOneAndUpdate({ user: user._id }, { $set: { items: [{ product: product._id, name: product.name, image: product.image, price: product.price, quantity: 1 }] } }, { upsert: true });
}
beforeAll(async () => {
  assertTestDatabase(process.env.MONGODB_URI);
  delete process.env.KHALTI_SECRET_KEY;
  await mongoose.connect(process.env.MONGODB_URI);
  user = await User.create({ name: 'Checkout methods test', email: shippingAddress.email, password: 'TestPass123!' });
  product = await Product.create({ sku: 'TEST-CHECKOUT-METHODS', name: 'Checkout methods CPU', brand: 'Test', category: 'cpu', price: 1500, stock: 4, catalogVerified: true });
  token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
});
afterAll(async () => {
  if (mongoose.connection.readyState) {
    await Cart.deleteMany({ user: user?._id });
    await Order.deleteMany({ user: user?._id });
    await Product.deleteMany({ _id: product?._id });
    await User.deleteMany({ _id: user?._id });
    await mongoose.disconnect();
  }
});
it('bank checkout creates a Pending order and only admin can confirm receipt', async () => {
  await addCart();
  const placed = await request(app).post('/api/orders').set(auth()).send({ shippingAddress, paymentMethod: 'bank' });
  expect(placed.status).toBe(201);
  expect(placed.body.order.paymentStatus).toBe('Pending');
  expect(placed.body.order.bankDetails.bankName).toContain('TEST');
  const id = placed.body.order._id;
  const blocked = await request(app).patch(`/api/admin/orders/${id}/payment-status`).set(auth()).send({ paymentStatus: 'Paid' });
  expect(blocked.status).toBe(403);
  expect((await Order.findById(id)).paymentStatus).toBe('Pending');
});
it('local Khalti checkout makes a Pending order, then approves only for owner', async () => {
  await addCart();
  const placed = await request(app).post('/api/orders').set(auth()).send({ shippingAddress, paymentMethod: 'khalti' });
  expect(placed.status).toBe(201);
  expect(placed.body.order.paymentStatus).toBe('Pending');
  expect(placed.body.khaltiPayment.payment_url).toContain('/khalti-test/');
  const id = placed.body.order.orderId;
  expect((await request(app).post(`/api/orders/khalti-local/${id}`).send({ choice: 'approve' })).status).toBe(401);
  const cancelled = await request(app).post(`/api/orders/khalti-local/${id}`).set(auth()).send({ choice: 'cancel' });
  expect(cancelled.body.order.paymentStatus).toBe('Pending');
  const approved = await request(app).post(`/api/orders/khalti-local/${id}`).set(auth()).send({ choice: 'approve' });
  expect(approved.status).toBe(200);
  expect(approved.body.order.paymentStatus).toBe('Paid');
  expect((await request(app).post(`/api/orders/khalti-local/${id}`).set(auth()).send({ choice: 'approve' })).body.order.paymentStatus).toBe('Paid');
});
