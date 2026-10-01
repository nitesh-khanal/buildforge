import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useSiteConfig } from '../lib/siteConfig';
import { analyticsPage, PUBLIC_ROUTES } from '../lib/siteFeatures.mjs';
const KEY = 'buildforge_analytics_consent';
function readConsent() { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } }
function setMeta(selector, attributes) {
  let node = document.head.querySelector(selector);
  if (!node) { node = document.createElement('meta'); document.head.appendChild(node); }
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
}
export default function SiteFeatures() {
  const { pathname } = useLocation();
  const config = useSiteConfig();
  const [consent, setConsent] = useState(readConsent);
  const [preferences, setPreferences] = useState(false);
  const lastPage = useRef('');
  useEffect(() => {
    const onPreferences = () => setPreferences(true);
    window.addEventListener('analytics-preferences', onPreferences);
    return () => window.removeEventListener('analytics-preferences', onPreferences);
  }, []);
  useEffect(() => {
    const info = PUBLIC_ROUTES[pathname];
    const productPage = /^\/products\/[a-f0-9]{24}$/i.test(pathname);
    if (!productPage) {
      document.title = info?.[0] || 'BuildForge';
      setMeta('meta[name="description"]', { name: 'description', content: info?.[1] || 'BuildForge account and shopping tools.' });
      setMeta('meta[property="og:title"]', { property: 'og:title', content: document.title });
      setMeta('meta[property="og:description"]', { property: 'og:description', content: info?.[1] || '' });
      document.getElementById('product-schema')?.remove();
    }
    setMeta('meta[name="robots"]', { name: 'robots', content: config.indexable && info ? 'index,follow' : 'noindex,follow' });
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical); }
    canonical.href = `${(config.publicUrl || window.location.origin).replace(/\/$/, '')}${pathname}`;
    setMeta('meta[property="og:url"]', { property: 'og:url', content: canonical.href });
  }, [pathname, config.publicUrl, config.indexable]);
  useEffect(() => {
    const id = config.analyticsId;
    if (!id) return;
    const page = analyticsPage(pathname, window.location.origin);
    const allowed = consent === 'accepted' && Boolean(page);
    window[`ga-disable-${id}`] = !allowed;
    if (!allowed) { lastPage.current = ''; return; }
    const key = `${id}:${pathname}`;
    if (lastPage.current === key) return;
    lastPage.current = key;
    if (!window.gtag) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
      window.gtag('js', new Date());
      window.gtag('config', id, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false, ...page });
      const script = document.createElement('script'); script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
      document.head.appendChild(script);
    }
    window.gtag('event', 'page_view', { ...page, send_to: id });
  }, [pathname, consent, config.analyticsId]);
  function choose(value) {
    try { localStorage.setItem(KEY, value); } catch { /* Preference applies to this tab if storage is unavailable. */ }
    setConsent(value); setPreferences(false);
    if (value !== 'accepted' && window.gtag) {
      window[`ga-disable-${config.analyticsId}`] = true;
      // Reload removes the collector and honors the persisted opt-out.
      window.location.reload();
    }
  }
  if (!config.analyticsId || (consent && !preferences) || pathname.startsWith('/admin')) return null;
  return <section aria-label="Analytics preferences" className="fixed bottom-4 left-4 right-4 sm:left-auto sm:w-[440px] z-50 border border-border bg-surface rounded p-5 shadow-xl">
    <h2 className="font-medium text-ink">Optional analytics</h2><p className="text-sm text-muted mt-2">Allow optional browsing measurements to help improve the store? Shopping works either way. We exclude account and checkout pages.</p>
    <a href="/privacy" className="text-accent text-sm underline">Privacy information</a>
    <div className="flex gap-3 mt-4"><button type="button" onClick={() => choose('declined')} className="btn-secondary">Decline</button><button type="button" onClick={() => choose('accepted')} className="btn-primary">Allow analytics</button></div>
  </section>;
}
