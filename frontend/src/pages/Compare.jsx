import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import { useCart } from '../context/CartContext';
import { useCompare } from '../context/CompareContext';
import { formatNPR, resolveImageUrl } from '../utils/format';
import { getComparisonRows, formatSpecValue, CATEGORY_LABELS } from '../utils/specs';
import StockBadge from '../components/StockBadge';

export default function Compare() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const idsParam = searchParams.get('ids') || '';
  const ids = idsParam.split(',').filter(Boolean);
  const { addItem } = useCart();
  const { remove, clear } = useCompare();

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState(null);

  useEffect(() => {
    if (ids.length < 2) {
      setLoading(false);
      setData(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get(`/products/compare?ids=${ids.join(',')}`)
      .then(({ data }) => !cancelled && setData(data))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [idsParam]);

  async function handleAdd(productId) {
    setAddingId(productId);
    await addItem(productId, 1);
    setAddingId(null);
  }

  function handleRemove(productId) {
    remove(productId);
    const remaining = ids.filter((id) => id !== productId);
    navigate(remaining.length >= 2 ? `/compare?ids=${remaining.join(',')}` : '/compare', { replace: true });
  }

  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center justify-between gap-4 mb-8">
        <h1 className="font-display text-2xl font-semibold text-ink">Compare products</h1>
        {data && (
          <button
            type="button"
            onClick={() => {
              clear();
              navigate('/compare', { replace: true });
            }}
            className="text-sm text-muted hover:text-ink"
          >
            Clear all
          </button>
        )}
      </div>

      {ids.length < 2 && (
        <div className="text-center py-16">
          <p className="text-muted mb-4">
            Pick 2–4 products from the shop to compare them side by side.
          </p>
          <Link to="/shop" className="btn-secondary inline-flex">
            Browse the shop
          </Link>
        </div>
      )}

      {loading && ids.length >= 2 && <p className="text-sm text-faint">Loading comparison…</p>}

      {error && (
        <div className="text-center py-16">
          <p className="text-stock-out mb-4">{error}</p>
          <Link to="/shop" className="btn-secondary inline-flex">
            Back to shop
          </Link>
        </div>
      )}

      {data && !loading && !error && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[560px]">
            <thead>
              <tr>
                <th className="w-40" />
                {data.products.map((p) => (
                  <th key={p._id} className="text-left align-top px-3 pb-6 min-w-[180px]">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => handleRemove(p._id)}
                        aria-label={`Remove ${p.name}`}
                        className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-surface border border-border-soft text-xs text-muted hover:text-accent flex items-center justify-center"
                      >
                        ✕
                      </button>
                      <Link
                        to={`/products/${p._id}`}
                        className="block aspect-square bg-surface border border-border-soft rounded overflow-hidden mb-3"
                      >
                        <img
                          src={resolveImageUrl(p.image)}
                          alt={p.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </Link>
                      <p className="text-xs font-mono text-faint uppercase">{p.brand}</p>
                      <Link
                        to={`/products/${p._id}`}
                        className="font-display font-medium text-ink leading-snug hover:text-accent transition-colors"
                      >
                        {p.name}
                      </Link>
                      <p className="font-display font-semibold text-ink mt-2">{formatNPR(p.price)}</p>
                      <div className="mt-1">
                        <StockBadge status={p.stockStatus} stock={p.stock} />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAdd(p._id)}
                        disabled={p.stockStatus === 'out-of-stock' || addingId === p._id}
                        className="btn-primary w-full mt-3 py-2 text-xs disabled:opacity-40"
                      >
                        {addingId === p._id
                          ? 'Adding…'
                          : p.stockStatus === 'out-of-stock'
                          ? 'Sold out'
                          : 'Add to cart'}
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {getComparisonRows(data.category, data.specKeys).map((row) => (
                <tr key={row.key} className="border-t border-border-soft">
                  <td className="py-2.5 pr-3 text-sm text-muted whitespace-nowrap">{row.label}</td>
                  {data.products.map((p) => (
                    <td key={p._id} className="py-2.5 px-3 text-sm font-mono text-ink">
                      {formatSpecValue(p, row.key, row.unit)}
                    </td>
                  ))}
                </tr>
              ))}
              {getComparisonRows(data.category, data.specKeys).length === 0 && (
                <tr>
                  <td colSpan={data.products.length + 1} className="py-6 text-sm text-faint text-center">
                    No comparable specifications found for these {CATEGORY_LABELS[data.category] || 'products'}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
