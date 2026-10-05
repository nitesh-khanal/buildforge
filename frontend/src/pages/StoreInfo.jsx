import { useSiteConfig } from '../lib/siteConfig';
export default function StoreInfo({ page }) {
  const config = useSiteConfig();
  const title = { privacy: 'Privacy', shipping: 'Shipping', returns: 'Returns & warranty', contact: 'Contact' }[page];
  return <article className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-6">
    <h1 className="font-display text-3xl font-semibold text-ink">{title}</h1>
    {page === 'privacy' ? <div className="space-y-4 text-muted text-sm leading-7">
      <p>BuildForge stores the information you provide for your account and orders, including your name, email, shipping address and order history. Passwords are stored as hashes. Essential session and cart storage lets you sign in and keep your cart.</p>
      <p>Optional marketing measurement is disabled until you allow it. BuildForge then counts product card impressions, product clicks and successful add-to-cart actions for 90 days without storing your name, email, search terms or order identifiers in marketing events. If configured, Google Analytics and Meta Pixel also measure public browsing and product actions under their own policies. Account, checkout and admin pages are excluded.</p>
      <button type="button" className="btn-secondary" onClick={() => window.dispatchEvent(new Event('analytics-preferences'))}>Change analytics preference</button>
      <p>For questions about account or order data, use the contact details below. Your store operator must publish any additional privacy information required for its actual business before launch.</p>
    </div> : page === 'contact' ? <p className="text-muted">Questions about a part or order? Contact {config.storeName} using the details below.</p> :
      <p className="text-muted whitespace-pre-line leading-7">{(page === 'shipping' ? config.shippingPolicy : config.returnPolicy) || 'This information will be published before orders open.'}</p>}
    <div className="border-t border-border-soft pt-5 text-sm text-muted space-y-2">
      <p className="font-medium text-ink">{config.storeName}</p>
      {config.supportEmail ? <a className="text-accent" href={`mailto:${config.supportEmail}`}>{config.supportEmail}</a> : <p>Support contact will be published before orders open.</p>}
      {config.storeAddress && <p>{config.storeAddress}</p>}
    </div>
  </article>;
}
