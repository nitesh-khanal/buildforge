import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { formatNPR } from '../utils/format';
import StockBadge from '../components/StockBadge';

function apiOrigin() {
  return import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
}

function WishlistRow({ item, onRemoved, onMoved }) {
  const { product } = item;
  const [busy, setBusy] = useState(null); // null | 'moving' | 'removing'
  const [error, setError] = useState(null);
  const outOfStock = product.stockStatus === 'out-of-stock';

  async function handleMoveToCart() {
    setBusy('moving');
    setError(null);
    try {
      await api.post(`/wishlist/${product._id}/move-to-cart`);
      onMoved(product._id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove() {
    setBusy('removing');
    setError(null);
    try {
      await api.delete(`/wishlist/${product._id}`);
      onRemoved(product._id);
    } catch (err) {
      setError(err.message);
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-4 border border-border-soft rounded p-3">
      <Link to={`/products/${product._id}`} className="w-20 h-20 shrink-0 bg-raised rounded overflow-hidden flex items-center justify-center">
        <img
          src={product.image?.startsWith('http') ? product.image : `${apiOrigin()}${product.image}`}
          alt={product.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      </Link>

      <div className="flex-1 min-w-0">
        <Link to={`/products/${product._id}`} className="font-display text-ink hover:text-accent transition-colors">
          {product.name}
        </Link>
        <div className="flex items-center gap-3 mt-1">
          <span className="font-mono text-sm text-ink">{formatNPR(product.price)}</span>
          <StockBadge status={product.stockStatus} stock={product.stock} />
        </div>
        {error && <p className="text-xs text-stock-out mt-1">{error}</p>}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={handleMoveToCart}
          disabled={outOfStock || busy !== null}
          className="btn-secondary py-2 px-3 text-xs disabled:opacity-40"
        >
          {busy === 'moving' ? 'Moving…' : outOfStock ? 'Out of stock' : 'Move to cart'}
        </button>
        <button
          type="button"
          onClick={handleRemove}
          disabled={busy !== null}
          aria-label="Remove from wishlist"
          className="w-9 h-9 flex items-center justify-center rounded border border-border-soft hover:border-accent text-muted hover:text-accent transition-colors disabled:opacity-40"
        >
          {busy === 'removing' ? '…' : '✕'}
        </button>
      </div>
    </div>
  );
}

export default function Wishlist() {
  const { refresh: refreshWishlistIds } = useWishlist();
  const { refresh: refreshCart } = useCart();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get('/wishlist')
      .then(({ data }) => setItems(data.items))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function handleRemoved(productId) {
    setItems((prev) => prev.filter((i) => i.product._id !== productId));
    refreshWishlistIds();
  }

  function handleMoved(productId) {
    setItems((prev) => prev.filter((i) => i.product._id !== productId));
    refreshWishlistIds();
    refreshCart();
  }

  if (loading) {
    return <div className="max-w-content mx-auto px-4 sm:px-6 py-16 text-sm text-faint">Loading your wishlist…</div>;
  }

  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-display text-2xl font-semibold text-ink mb-8">Your wishlist</h1>

      {error && <p className="text-sm text-stock-out mb-4">{error}</p>}

      {!error && items.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted mb-4">Nothing saved yet.</p>
          <Link to="/shop" className="btn-secondary inline-flex">
            Browse the shop
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <WishlistRow key={item._id} item={item} onRemoved={handleRemoved} onMoved={handleMoved} />
          ))}
        </div>
      )}
    </div>
  );
}
