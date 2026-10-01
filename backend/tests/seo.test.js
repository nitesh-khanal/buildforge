const { renderPage, productSchema, escape } = require('../utils/seo');
const env = { CLIENT_URL: 'https://shop.example.org', SITE_INDEXABLE: 'true' };
const html = '<html><head><title>Old</title><meta name="description" content="old"></head><body></body></html>';
const product = { _id: '507f1f77bcf86cd799439011', name: 'A <script>bad</script> "part"', brand: 'Brand', description: 'Great & fast', image: '/uploads/part.jpg', price: 1000, stock: 0, catalogVerified: true };
it('renders metadata before JavaScript and escapes imported text', () => {
  const rendered = renderPage(html, `/products/${product._id}`, product, env);
  expect(rendered).toContain('A &lt;script&gt;bad&lt;/script&gt; &quot;part&quot;');
  expect(rendered).not.toContain('<script>bad</script>');
  expect(rendered).toContain('\\u003cscript\\u003e');
  expect(rendered).toContain('https://schema.org/OutOfStock');
  expect(rendered.match(/<title>/g)).toHaveLength(1);
});
it('uses the configured canonical origin, independent of the request host', () => {
  expect(renderPage(html, '/shop', null, env)).toContain('href="https://shop.example.org/shop"');
});
it('excludes private and unknown routes from indexing', () => {
  for (const route of ['/admin', '/checkout', '/orders/secret', '/missing']) expect(renderPage(html, route, null, env)).toContain('noindex,follow');
});
it('excludes unverified and archived products and never creates fake rating data', () => {
  expect(renderPage(html, '/products/id', { ...product, catalogVerified: false }, env)).toContain('noindex,follow');
  const schema = productSchema({ ...product, isArchived: true }, env.CLIENT_URL);
  expect(schema.offers).toBeUndefined();
  expect(schema.aggregateRating).toBeUndefined();
});
it('keeps prelaunch storefronts out of indexing', () => {
  expect(renderPage(html, '/', null, { ...env, SITE_INDEXABLE: 'false' })).toContain('noindex,follow');
  expect(escape('a&b')).toBe('a&amp;b');
});
