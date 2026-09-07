import { useState } from 'react';
import { useCompare } from '../../context/CompareContext';

// Icon-only toggle for "add/remove this product to/from comparison" — used
// on ProductCard the same way the wishlist heart is, and on ProductDetail
// next to the wishlist/add-to-cart controls. `className` lets callers
// position it (ProductCard overlays it on the image; ProductDetail places
// it inline).
export default function CompareToggleButton({ product, className = '' }) {
  const { isComparing, toggle } = useCompare();
  const [message, setMessage] = useState(null);
  const comparing = isComparing(product._id);

  function handleClick(e) {
    e.preventDefault();
    e.stopPropagation();
    const res = toggle(product);
    if (!res.ok) {
      setMessage(res.message);
      setTimeout(() => setMessage(null), 2400);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        aria-label={comparing ? 'Remove from comparison' : 'Add to comparison'}
        aria-pressed={comparing}
        title={comparing ? 'Remove from comparison' : 'Add to comparison'}
        className={className}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M9 3v18M15 3v18" />
          <path d="M5 8h4M15 8h4M5 16h4M15 16h4" />
        </svg>
      </button>
      {message && (
        <div className="absolute z-10 top-full right-0 mt-1 w-44 text-[11px] leading-snug bg-base border border-border-soft rounded px-2 py-1.5 text-muted shadow-lg">
          {message}
        </div>
      )}
    </div>
  );
}
