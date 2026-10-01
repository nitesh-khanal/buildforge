import { test } from 'node:test';
import assert from 'node:assert/strict';
import { imageUrl, analyticsPath, analyticsPage } from '../src/lib/siteFeatures.mjs';
test('images work locally, under one domain and with a separate API host', () => {
  assert.equal(imageUrl('/uploads/part.jpg', '/api', 'https://shop.example.org'), 'https://shop.example.org/uploads/part.jpg');
  assert.equal(imageUrl('/uploads/part.jpg', 'https://api.example.org/api', 'https://shop.example.org'), 'https://api.example.org/uploads/part.jpg');
  assert.equal(imageUrl('https://cdn.example.org/part.jpg'), 'https://cdn.example.org/part.jpg');
  assert.equal(imageUrl('javascript:alert(1)'), '');
  assert.equal(imageUrl('//bad.example/image'), '');
});
test('analytics excludes private, unknown and malformed product paths', () => {
  for (const route of ['/admin', '/admin/products', '/checkout', '/login', '/orders/private', '/account/addresses', '/shop?email=private', '/products/private']) assert.equal(analyticsPath(route), null);
  assert.equal(analyticsPath('/shop'), '/shop');
});
test('analytics never includes query strings or order IDs', () => {
  const page = analyticsPage('/shop', 'https://shop.example.org/?email=customer@example.org');
  assert.equal(page.page_location, 'https://shop.example.org/shop');
  assert.equal(page.page_referrer, 'https://shop.example.org');
  assert.equal(analyticsPage('/order-confirmation/BF-123', 'https://shop.example.org'), null);
});
