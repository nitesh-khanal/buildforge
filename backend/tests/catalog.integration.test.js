require('dotenv').config();
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../app');
const Product = require('../models/Product');
const User = require('../models/User');
const assertTestDatabase = require('../utils/testDatabase');
const jwt = require('jsonwebtoken');
let token;
let photo;
const email = 'catalog-integration@buildforge.test';
const sku = 'CI-CATALOG-CPU';
beforeAll(async () => {
  assertTestDatabase(process.env.MONGODB_URI);
  await mongoose.connect(process.env.MONGODB_URI);
  await User.deleteMany({ email });
  await Product.deleteMany({ sku });
  await Product.createIndexes();
  const user = await User.create({ name: 'Catalog test administrator', email, password: 'TestOnlyPass123!', role: 'admin' });
  token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
  const upload = await request(app).post('/api/admin/products/catalog/photo').set('Authorization', `Bearer ${token}`).attach('image', Buffer.from([255, 216, 255, 0]), { filename: 'test.jpg', contentType: 'image/jpeg' });
  expect(upload.status).toBe(200); photo = upload.body.image;
});
afterAll(async () => {
  if (mongoose.connection.readyState) { await User.deleteMany({ email }); await Product.deleteMany({ sku }); }
  if (photo) require('fs').unlinkSync(require('path').join(__dirname, '..', photo));
  await mongoose.disconnect();
});
function row(overrides = {}) {
  return { sku, name: 'Catalog test CPU', brand: 'AMD', category: 'cpu', price: 40000, stock: 3, image: photo,
    sourceUrl: 'https://supplier.example.org/cpu', photoRightsConfirmed: true, commercialDataVerified: true, compatibilityReviewed: true,
    compatibilityData: { socket: 'AM5', tdp: 105 }, ...overrides };
}
it('previews without writes, then transactionally imports and updates the SKU while preserving reviews', async () => {
  const preview = await request(app).post('/api/admin/products/catalog/import').set('Authorization', `Bearer ${token}`).send({ dryRun: true, products: [row()] });
  expect(preview.status).toBe(200); expect(await Product.countDocuments({ sku })).toBe(0);
  const imported = await request(app).post('/api/admin/products/catalog/import').set('Authorization', `Bearer ${token}`).send({ dryRun: false, products: [row()] });
  expect(imported.status).toBe(200); expect(imported.body.created).toBe(1);
  await Product.updateOne({ sku }, { $set: { numReviews: 2, rating: 4.5 } });
  const updated = await request(app).post('/api/admin/products/catalog/import').set('Authorization', `Bearer ${token}`).send({ dryRun: false, products: [row({ price: 39000, stock: 4 })] });
  expect(updated.status).toBe(200); expect(updated.body.updated).toBe(1);
  const product = await Product.findOne({ sku });
  expect(product.price).toBe(39000); expect(product.catalogVerified).toBe(true); expect(product.numReviews).toBe(2); expect(product.rating).toBe(4.5);
});
it('rejects unauthorized or invalid imports without modifying inventory', async () => {
  expect((await request(app).post('/api/admin/products/catalog/import').send({ products: [row()], dryRun: false })).status).toBe(401);
  const response = await request(app).post('/api/admin/products/catalog/import').set('Authorization', `Bearer ${token}`).send({ dryRun: false, products: [row({ stock: -1 })] });
  expect(response.status).toBe(400);
  expect((await Product.findOne({ sku })).stock).toBe(4);
});
