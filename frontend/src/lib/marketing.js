export const ANALYTICS_CONSENT_KEY = 'buildforge_analytics_consent';
const seenImpressions = new Set();

export function analyticsAllowed() {
  try { return localStorage.getItem(ANALYTICS_CONSENT_KEY) === 'accepted'; }
  catch { return false; }
}

export function marketingSource(pathname) {
  if (pathname === '/') return 'home';
  if (pathname === '/shop') return 'shop';
  return 'related';
}

export function trackMarketingEvent(type, product, source) {
  if (!analyticsAllowed() || !/^[a-f0-9]{24}$/i.test(product) ||
      !['impression', 'click', 'conversion'].includes(type)) return false;
  if (type === 'impression') {
    const key = `${source}:${product}`;
    if (seenImpressions.has(key)) return false;
    seenImpressions.add(key);
  }
  const endpoint = `${(import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')}/marketing/events`;
  fetch(endpoint, {
    method: 'POST', credentials: 'omit', keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, product, source }),
  }).catch(() => {});
  if (window.fbq && window.__buildforgeMetaPixelId) {
    const data = { content_ids: [product], content_type: 'product' };
    if (type === 'conversion') window.fbq('track', 'AddToCart', data);
    else if (type === 'click') window.fbq('track', 'ViewContent', data);
    else window.fbq('trackCustom', 'ProductImpression', data);
  }
  return true;
}
