import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { formatNPR } from '../utils/format';
import { getSpecEntries } from '../utils/specs';
import StockBadge from './StockBadge';
import CompareToggleButton from './compare/CompareToggleButton';

export default function ProductCard({ product }) {
  const { addItem } = useCart();
  const { isWishlisted, toggle } = useWishlist();
  const [status, setStatus] = useState('idle'); // idle | adding | added | error
  const [wishBusy, setWishBusy] = useState(false);

  const specs = getSpecEntries(product, { limit: 3 });
  const outOfStock = product.stockStatus === 'out-of-stock';
  const wishlisted = isWishlisted(product._id);

  async function handleAdd(e) {
    e.preventDefault();
    e.stopPropagation();
    setStatus('adding');
    const res = await addItem(product._id, 1);
    setStatus(res.ok ? 'added' : 'error');
    if (res.ok) setTimeout(() => setStatus('idle'), 1400);
  }

  async function handleWishlist(e) {
    e.preventDefault();
    e.stopPropagation();
    if (wishBusy) return;
    setWishBusy(true);
    await toggle(product._id);
    setWishBusy(false);
  }

  return (
    <Link
      to={`/products/${product._id}`}
      className="group flex flex-col border border-border-soft hover:border-border bg-surface rounded transition-colors"
    >
      <div className="relative aspect-[4/3] bg-raised border-b border-border-soft flex items-center justify-center overflow-hidden">
        <img
          src={product.image?.startsWith('http') ? product.image : `${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000'}${product.image}`}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
          loading="lazy"
        />
        <button
          type="button"
          onClick={handleWishlist}
          disabled={wishBusy}
          aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-base/80 backdrop-blur flex items-center justify-center border border-border-soft hover:border-accent transition-colors disabled:opacity-50"
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill={wishlisted ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.8"
            className={wishlisted ? 'text-accent' : 'text-muted'}
          >
            <path d="M12 20.3s-7.5-4.6-9.8-9.2C.7 7.6 2.4 4 6 4c2 0 3.6 1.1 4.5 2.6C11.4 5.1 13 4 15 4c3.6 0 5.3 3.6 3.8 7.1-2.3 4.6-9.8 9.2-9.8 9.2Z" />
          </svg>
        </button>
        <CompareToggleButton
          product={product}
          className="absolute top-2 left-2 w-8 h-8 rounded-full bg-base/80 backdrop-blur flex items-center justify-center border border-border-soft hover:border-accent transition-colors text-muted aria-pressed:text-accent"
        />
      </div>

      <div className="flex flex-col gap-2 p-4 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-mono text-faint uppercase tracking-wide">{product.brand}</p>
          <StockBadge status={product.stockStatus} stock={product.stock} />
        </div>

        <h3 className="font-display font-medium text-ink leading-snug">{product.name}</h3>

        {specs.length > 0 && (
          <dl className="mt-1 space-y-0.5">
            {specs.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3 text-xs">
                <dt className="text-faint">{label}</dt>
                <dd className="font-mono text-muted truncate">{value}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="mt-auto pt-3 flex items-center justify-between gap-3">
          <span className="font-display font-semibold text-ink">{formatNPR(product.price)}</span>
          <button
            type="button"
            onClick={handleAdd}
            disabled={outOfStock || status === 'adding'}
            className="text-xs font-medium px-3 py-1.5 rounded border border-border hover:border-accent hover:text-accent
                       disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            {status === 'added' ? 'Added ✓' : status === 'adding' ? 'Adding…' : outOfStock ? 'Sold out' : 'Add'}
          </button>
        </div>
        {status === 'error' && <p className="text-xs text-stock-out">Couldn't add — try again.</p>}
      </div>
    </Link>
  );
}
