import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useSiteConfig } from '../lib/siteConfig';
import { analyticsPage, PUBLIC_ROUTES } from '../lib/siteFeatures.mjs';
import { ANALYTICS_CONSENT_KEY as KEY } from '../lib/marketing';
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
  const lastPixelPage = useRef('');
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
  useEffect(() => {
    const id = config.metaPixelId;
    const allowed = consent === 'accepted' && Boolean(analyticsPage(pathname, window.location.origin));
    if (!id || !allowed) { lastPixelPage.current = ''; return; }
    if (!window.fbq) {
      const fbq = function () { if (fbq.callMethod) fbq.callMethod.apply(fbq, arguments); else fbq.queue.push(arguments); };
      fbq.queue = []; fbq.loaded = true; fbq.version = '2.0';
      window.fbq = fbq;
      const script = document.createElement('script'); script.async = true;
      script.src = 'https://connect.facebook.net/en_US/fbevents.js';
      document.head.appendChild(script);
    }
    if (window.__buildforgeMetaPixelId !== id) {
      window.fbq('consent', 'grant');
      window.fbq('init', id);
      window.__buildforgeMetaPixelId = id;
    }
    if (lastPixelPage.current !== `${id}:${pathname}`) {
      lastPixelPage.current = `${id}:${pathname}`;
      window.fbq('track', 'PageView');
    }
  }, [pathname, consent, config.metaPixelId]);
  useEffect(() => {
    if (consent === 'accepted') window.dispatchEvent(new Event('analytics-consent-changed'));
  }, [consent, pathname, config.metaPixelId]);
  function choose(value) {
    try { localStorage.setItem(KEY, value); } catch { /* Preference applies to this tab if storage is unavailable. */ }
    setConsent(value); setPreferences(false);
    if (value !== 'accepted' && window.fbq) window.fbq('consent', 'revoke');
    if (value !== 'accepted' && (window.gtag || window.fbq)) {
      window[`ga-disable-${config.analyticsId}`] = true;
      // Reload removes the collector and honors the persisted opt-out.
      window.location.reload();
    }
  }
  if ((consent && !preferences) || pathname.startsWith('/admin')) return null;
  return <section aria-label="Analytics preferences" className="fixed bottom-4 left-4 right-4 sm:left-auto sm:w-[440px] z-50 border border-border bg-surface rounded p-5 shadow-xl">
    <h2 className="font-medium text-ink">Optional analytics</h2><p className="text-sm text-muted mt-2">Allow product impressions, clicks and add-to-cart conversions to be counted for the store demo? If a Google Analytics or Meta Pixel ID is configured, public browsing events may also be sent to that service. Shopping works either way. Account, checkout and admin pages are excluded.</p>
    <a href="/privacy" className="text-accent text-sm underline">Privacy information</a>
    <div className="flex gap-3 mt-4"><button type="button" onClick={() => choose('declined')} className="btn-secondary">Decline</button><button type="button" onClick={() => choose('accepted')} className="btn-primary">Allow analytics</button></div>
  </section>;
}
