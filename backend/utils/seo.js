const PUBLIC_PAGES = {
  '/': ['BuildForge — PC Parts & Custom PC Builder Nepal', 'Shop PC components in NPR and plan a compatible custom PC with BuildForge.'],
  '/shop': ['PC Parts in Nepal | BuildForge', 'Browse CPUs, graphics cards, motherboards, memory, storage and more.'],
  '/build': ['Custom PC Builder | BuildForge', 'Choose PC components and check socket, memory, size and power compatibility.'],
  '/community': ['Community PC Builds | BuildForge', 'Explore PC builds shared by the BuildForge community.'],
  '/privacy': ['Privacy | BuildForge', 'How BuildForge uses account, order and optional analytics data.'],
  '/shipping': ['Shipping | BuildForge', 'Shipping information for BuildForge orders.'],
  '/returns': ['Returns | BuildForge', 'Return and warranty information for BuildForge orders.'],
  '/contact': ['Contact | BuildForge', 'Contact BuildForge for product and order support.'],
};
function escape(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
function jsonLd(value) { return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026'); }
function origin(env = process.env) { return (env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, ''); }
function productSchema(product, base) {
  const schema = { '@context': 'https://schema.org', '@type': 'Product', name: product.name, description: product.description || product.name, brand: { '@type': 'Brand', name: product.brand } };
  if (product.sku) schema.sku = product.sku;
  if (product.mpn) schema.mpn = product.mpn;
  if (product.image && !product.image.includes('placeholder')) schema.image = new URL(product.image, base).href;
  if (product.catalogVerified && !product.isArchived) schema.offers = {
    '@type': 'Offer', url: `${base}/products/${product._id}`, priceCurrency: 'NPR', price: product.price,
    availability: product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', itemCondition: 'https://schema.org/NewCondition',
  };
  if (product.numReviews > 0 && product.rating > 0) schema.aggregateRating = { '@type': 'AggregateRating', ratingValue: product.rating, reviewCount: product.numReviews };
  return schema;
}
function renderPage(html, pathname, product, env = process.env) {
  const base = origin(env);
  const route = PUBLIC_PAGES[pathname];
  const indexable = env.SITE_INDEXABLE === 'true' && (Boolean(route) || Boolean(product && !product.isArchived && product.catalogVerified));
  const title = product ? `${product.name} | BuildForge` : route?.[0] || 'BuildForge';
  const description = product ? (product.description || `Explore ${product.name} from ${product.brand}.`).slice(0, 300) : route?.[1] || 'BuildForge account and shopping tools.';
  const url = `${base}${pathname}`;
  const image = product?.image && !product.image.includes('placeholder') ? new URL(product.image, base).href : env.SOCIAL_IMAGE_URL || `${base}/social-card.svg`;
  const schema = product ? productSchema(product, base) : pathname === '/' ? { '@context': 'https://schema.org', '@type': 'WebSite', name: 'BuildForge', url: base } : null;
  const tags = `<title>${escape(title)}</title>
<meta name="description" content="${escape(description)}">
<meta name="robots" content="${indexable ? 'index,follow' : 'noindex,follow'}">
<link rel="canonical" href="${escape(url)}">
<meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}">
<meta property="og:url" content="${escape(url)}"><meta property="og:type" content="${product ? 'product' : 'website'}">
<meta property="og:image" content="${escape(image)}"><meta name="twitter:card" content="summary_large_image">
${schema ? `<script id="product-schema" type="application/ld+json">${jsonLd(schema)}</script>` : ''}`;
  return html.replace(/<title>[\s\S]*?<\/title>/i, '').replace(/<meta name="description"[^>]*>/i, '').replace('</head>', `${tags}</head>`);
}
module.exports = { PUBLIC_PAGES, escape, jsonLd, origin, productSchema, renderPage };
