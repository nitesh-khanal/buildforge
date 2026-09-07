import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { formatNPR } from '../utils/format';
import QuantityStepper from '../components/QuantityStepper';

function apiOrigin() {
  return import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
}

function CartItemRow({ item }) {
  const { updateQuantity, removeItem, pendingItemId } = useCart();
  const pending = pendingItemId === item._id;

  return (
    <div className="flex gap-4 py-5 border-b border-border-soft">
      <div className="w-20 h-20 shrink-0 bg-surface border border-border-soft rounded overflow-hidden flex items-center justify-center">
        <img
          src={item.image?.startsWith('http') ? item.image : `${apiOrigin()}${item.image}`}
          alt={item.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-ink font-medium truncate">{item.name}</p>
            {item.isCustomBuild && (
              <p className="text-xs font-mono text-accent mt-0.5">Custom PC build</p>
            )}
          </div>
          <p className="font-mono text-ink shrink-0">{formatNPR(item.price * item.quantity)}</p>
        </div>

        {item.isCustomBuild && item.buildComponents?.length > 0 && (
          <ul className="mt-2 space-y-0.5">
            {item.buildComponents.map((c, i) => (
              <li key={i} className="flex justify-between text-xs text-faint">
                <span>{c.name}</span>
                <span className="font-mono">{formatNPR(c.price)}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between mt-3">
          <QuantityStepper
            value={item.quantity}
            onChange={(q) => updateQuantity(item._id, q)}
            disabled={pending}
          />
          <button
            type="button"
            onClick={() => removeItem(item._id)}
            disabled={pending}
            className="text-xs text-faint hover:text-stock-out transition-colors disabled:opacity-40"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Cart() {
  const { cart, loading, error, subtotal, itemCount, clearCart } = useCart();

  if (loading) {
    return <div className="max-w-content mx-auto px-4 sm:px-6 py-16 text-sm text-faint">Loading your cart…</div>;
  }

  const items = cart?.items || [];

  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-display text-2xl font-semibold text-ink mb-8">
        Cart{itemCount > 0 ? ` · ${itemCount} item${itemCount === 1 ? '' : 's'}` : ''}
      </h1>

      {error && <p className="text-sm text-stock-out mb-4">{error}</p>}

      {items.length === 0 ? (
        <div className="border border-border-soft rounded p-16 text-center">
          <p className="text-ink font-medium">Your cart is empty.</p>
          <p className="text-sm text-faint mt-1">Add a part or start a custom build to see it here.</p>
          <Link to="/shop" className="btn-primary mt-6 inline-flex">
            Browse parts
          </Link>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_320px] gap-10 items-start">
          <div>
            {items.map((item) => (
              <CartItemRow key={item._id} item={item} />
            ))}
            <button type="button" onClick={clearCart} className="text-xs text-faint hover:text-ink mt-4 underline underline-offset-4">
              Clear cart
            </button>
          </div>

          <div className="border border-border-soft rounded p-5 lg:sticky lg:top-24">
            <h2 className="text-sm font-medium text-ink mb-4">Order summary</h2>
            <div className="spec-row">
              <span className="spec-label">Subtotal</span>
              <span className="spec-value">{formatNPR(subtotal)}</span>
            </div>
            <div className="spec-row">
              <span className="spec-label">Shipping</span>
              <span className="spec-value text-faint">Calculated at checkout</span>
            </div>
            <div className="flex items-baseline justify-between pt-4 mt-1">
              <span className="text-ink font-medium">Total</span>
              <span className="font-display text-xl font-semibold text-ink">{formatNPR(subtotal)}</span>
            </div>
            <Link to="/checkout" className="btn-primary w-full mt-5">
              Checkout
            </Link>
            <p className="text-xs text-faint text-center mt-3">COD, card, or eSewa at checkout.</p>
          </div>
        </div>
      )}
    </div>
  );
}
