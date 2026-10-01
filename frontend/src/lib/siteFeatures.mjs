export const PUBLIC_ROUTES = {
  '/': ['BuildForge — PC Parts & Custom PC Builder Nepal', 'Shop PC components in NPR and plan a compatible custom PC.'],
  '/shop': ['PC Parts in Nepal | BuildForge', 'Browse CPUs, graphics cards, memory, storage and more.'],
  '/build': ['Custom PC Builder | BuildForge', 'Choose components and check PC compatibility.'],
  '/community': ['Community Builds | BuildForge', 'Explore PC builds shared by our community.'],
  '/privacy': ['Privacy | BuildForge', 'How BuildForge uses account, order and optional analytics data.'],
  '/shipping': ['Shipping | BuildForge', 'BuildForge shipping information.'],
  '/returns': ['Returns | BuildForge', 'BuildForge return and warranty information.'],
  '/contact': ['Contact | BuildForge', 'Contact BuildForge for support.'],
};
export function analyticsPath(path) {
  if (['/', '/shop', '/build', '/community'].includes(path)) return path;
  if (/^\/products\/[a-f0-9]{24}$/i.test(path)) return path;
  return null;
}
export function analyticsPage(path, base) {
  const publicPath = analyticsPath(path);
  return publicPath ? { page_location: `${new URL(base).origin}${publicPath}`, page_title: PUBLIC_ROUTES[publicPath]?.[0] || 'Product | BuildForge', page_referrer: new URL(base).origin } : null;
}
export function imageUrl(image, apiUrl = '/api', base = 'http://localhost:5173') {
  if (!image) return '';
  try {
    if (/^https?:\/\//i.test(image)) return new URL(image).href;
    if (!image.startsWith('/') || image.startsWith('//')) return '';
    const origin = new URL(apiUrl, base).origin;
    return new URL(image, origin).href;
  } catch { return ''; }
}
