const request = require('supertest');
const Product = require('../models/Product');
const fs = require('fs');
const path = require('path');
const dist = fs.mkdtempSync(path.join(require('os').tmpdir(), 'buildforge-storefront-'));
fs.writeFileSync(path.join(dist, 'index.html'), '<html><head><title>BuildForge</title></head><body><div id="root"></div></body></html>');
process.env.FRONTEND_DIST = dist;
const app = require('../app');
afterAll(() => fs.rmSync(dist, { recursive: true, force: true }));
const id = '507f1f77bcf86cd799439011';
beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => {}); process.env.CLIENT_URL = 'https://shop.example.org'; process.env.SITE_INDEXABLE = 'true'; });
afterEach(() => jest.restoreAllMocks());
it('serves the storefront and deep links with server-generated metadata', async () => {
  const response = await request(app).get('/shop');
  expect(response.status).toBe(200);
  expect(response.text).toContain('PC Parts in Nepal | BuildForge');
  expect(response.text).toContain('href="https://shop.example.org/shop"');
  expect(response.headers['content-security-policy']).toContain('form-action');
});
it('serves product SEO and structured data without relying on JavaScript', async () => {
  jest.spyOn(Product, 'findById').mockReturnValue({ lean: () => Promise.resolve({ _id: id, name: 'Test CPU', brand: 'AMD', image: '/uploads/test.jpg', stock: 2, price: 20000, catalogVerified: true }) });
  const response = await request(app).get(`/products/${id}`);
  expect(response.status).toBe(200);
  expect(response.text).toContain('Test CPU | BuildForge');
  expect(response.text).toContain('application/ld+json');
  expect(response.text).toContain('https://schema.org/InStock');
});
it('returns HTTP 404 for missing pages/products instead of a soft 404', async () => {
  expect((await request(app).get('/unknown-route')).status).toBe(404);
  expect((await request(app).get('/products/not-an-object-id')).status).toBe(404);
  expect((await request(app).get('/api/unknown-route')).status).toBe(404);
});
it('publishes sitemap and robots using the canonical origin', async () => {
  jest.spyOn(Product, 'countDocuments').mockResolvedValue(10001);
  const response = await request(app).get('/sitemap.xml');
  expect(response.status).toBe(200);
  expect(response.text).toContain('https://shop.example.org/sitemaps/1.xml');
  expect((await request(app).get('/robots.txt')).text).toContain('Sitemap: https://shop.example.org/sitemap.xml');
});
it('disables indexing before launch and rejects unauthenticated catalog imports', async () => {
  process.env.SITE_INDEXABLE = 'false';
  expect((await request(app).get('/robots.txt')).text).toContain('Disallow: /');
  expect((await request(app).post('/api/admin/products/catalog/import').send({ products: [] })).status).toBe(401);
});
it('handles malformed JSON and leaves secrets out of site configuration', async () => {
  const response = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{');
  expect(response.status).toBe(400);
  expect(response.body.message).toBe('Invalid JSON request.');
  const config = await request(app).get('/api/site-config');
  expect(config.status).toBe(200);
  expect(config.body.MONGODB_URI).toBeUndefined();
});
