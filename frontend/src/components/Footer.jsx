import { Link } from 'react-router-dom';
import BrandLogo from './BrandLogo';
import { useSiteConfig } from '../lib/siteConfig';

export default function Footer() {
  const site = useSiteConfig();
  return (
    <footer className="border-t border-border-soft mt-20">
      <div className="max-w-content mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row justify-between gap-6 text-sm text-faint">
        <div>
          <p className="font-display text-ink font-semibold">
            <BrandLogo />
          </p>
          <p className="mt-1 max-w-xs">PC parts and custom builds, checked for compatibility before they reach your cart.</p>
        </div>
        <div className="flex flex-wrap gap-10">
          <div className="space-y-1"><p className="text-muted mb-2">Help</p>
            {['contact', 'shipping', 'returns', 'privacy'].map((page) => <Link key={page} to={`/${page}`} className="block capitalize hover:text-accent">{page}</Link>)}
            <button type="button" className="block hover:text-accent" onClick={() => window.dispatchEvent(new Event('analytics-preferences'))}>Analytics preferences</button>
          </div>
          <div className="space-y-1">
            <p className="text-muted mb-2">Shop</p>
            <Link className="block hover:text-accent" to="/shop">Components</Link>
            <Link className="block hover:text-accent" to="/build">Custom builds</Link>
          </div>
          <div className="space-y-1">
            <p className="text-muted mb-2">Prices</p>
            <p>All prices in NPR</p>
            <p>{site.checkoutEnabled ? site.paymentMethods.map((method) => method.label).join(', ') : 'Orders opening soon'}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
