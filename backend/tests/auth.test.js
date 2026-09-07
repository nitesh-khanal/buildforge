/**
 * These are basic integration tests for auth. They require a real MongoDB
 * connection (set MONGODB_URI to a *test* database before running — never
 * point this at production data, since it clears users/products).
 *
 * Run with: npm test
 *
 * More test suites (cart, compatibility, checkout, inventory) are added
 * incrementally in later phases as those features are built — see
 * ROADMAP.md.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../app');
const User = require('../models/User');

const TEST_EMAIL = 'jest-test-user@buildforge.com';

beforeAll(async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('Set MONGODB_URI (a test database) before running tests.');
  }
  await mongoose.connect(process.env.MONGODB_URI);
  await User.deleteMany({ email: TEST_EMAIL });
});

afterAll(async () => {
  await User.deleteMany({ email: TEST_EMAIL });
  await mongoose.disconnect();
});

describe('Auth', () => {
  it('registers a new user', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Jest User',
      email: TEST_EMAIL,
      password: 'TestPass123!',
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.user.email).toBe(TEST_EMAIL);
    expect(res.body.user.password).toBeUndefined();
  });

  it('rejects duplicate registration', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Jest User',
      email: TEST_EMAIL,
      password: 'TestPass123!',
    });
    expect(res.statusCode).toBe(400);
  });

  it('logs in with correct credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: TEST_EMAIL,
      password: 'TestPass123!',
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('rejects login with wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: TEST_EMAIL,
      password: 'WrongPassword',
    });
    expect(res.statusCode).toBe(401);
  });

  it('blocks unauthorized access to /api/orders (login required for checkout/history)', async () => {
    const res = await request(app).get('/api/orders');
    expect(res.statusCode).toBe(401);
  });

  it('allows access to /api/products without login (browsing rule)', async () => {
    const res = await request(app).get('/api/products');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
