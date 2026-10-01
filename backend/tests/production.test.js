const { productionErrors, paymentMethods, siteConfig } = require('../config/production');
const env = { NODE_ENV: 'production', CLIENT_URL: 'https://shop.example.org', BACKEND_URL: 'https://shop.example.org', MONGODB_URI: 'mongodb://db/buildforge', JWT_SECRET: 'a'.repeat(40) };
it('permits a closed storefront without optional accounts', () => {
  expect(productionErrors(env)).toEqual([]);
  expect(siteConfig(env).checkoutEnabled).toBe(false);
  expect(paymentMethods(env).map((method) => method.id)).toEqual(['cod']);
});
it('rejects weak credentials and non-HTTPS production origins', () => {
  expect(productionErrors({ ...env, JWT_SECRET: 'changeme', CLIENT_URL: 'http://localhost:5173' })).toHaveLength(2);
  expect(productionErrors({ ...env, BACKEND_URL: 'https://user:password@example.org/path?q=x' })).toHaveLength(1);
});
it('never exposes demo card payments in production', () => {
  expect(paymentMethods({ ...env, ALLOW_DEMO_CARD: 'true' }).some((method) => method.id === 'card')).toBe(false);
});
it('requires real eSewa credentials when enabled', () => {
  expect(productionErrors({ ...env, ESEWA_ENABLED: 'true', ESEWA_TEST_MODE: 'true' }).join(' ')).toMatch(/production merchant/);
});
it('requires fulfillment information before opening orders', () => {
  expect(productionErrors({ ...env, CHECKOUT_ENABLED: 'true' }).join(' ')).toMatch(/SHIPPING_POLICY/);
});
it('returns public configuration without database, signing or merchant secrets', () => {
  const value = JSON.stringify(siteConfig({ ...env, ESEWA_SECRET_KEY: 'hidden-merchant-secret', EMAIL_PASSWORD: 'hidden-smtp-password' }));
  expect(value).not.toContain(env.JWT_SECRET);
  expect(value).not.toContain('hidden-merchant-secret');
  expect(value).not.toContain('hidden-smtp-password');
});
