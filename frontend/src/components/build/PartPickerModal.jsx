import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { formatNPR } from '../../utils/format';
import { getSpecEntries, CATEGORY_LABELS } from '../../utils/specs';
import StockBadge from '../StockBadge';
import Pagination from '../Pagination';

function apiOrigin() {
  return new URL(import.meta.env.VITE_API_URL || '/api', window.location.origin).origin;
}

const SORT_OPTIONS = [
  { value: '', label: 'Newest' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Top rated' },
];

function PickerCard({ product, preview, checkingPreview, onSelect }) {
  const specs = getSpecEntries(product, { limit: 3 });
  const outOfStock = product.stockStatus === 'out-of-stock';

  return (
    <button
      type="button"
      onClick={() => onSelect(product)}
      disabled={outOfStock}
      className={`text-left flex flex-col border hover:border-accent bg-surface rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${preview?.status === 'error' ? 'border-stock-out' : preview?.status === 'warning' ? 'border-stock-low' : 'border-border-soft'}`}
    >
      <div className="aspect-[4/3] bg-raised border-b border-border-soft flex items-center justify-center overflow-hidden">
        <img
          src={product.image?.startsWith('http') ? product.image : `${apiOrigin()}${product.image}`}
          alt={product.name}
          className="w-full h-full object-contain"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = '/placeholder.svg';
          }}
          loading="lazy"
        />
      </div>
      <div className="flex flex-col gap-1.5 p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-mono text-faint uppercase tracking-wide">{product.brand}</p>
          <StockBadge status={product.stockStatus} stock={product.stock} />
        </div>
        <h3 className="font-display text-sm font-medium text-ink leading-snug">{product.name}</h3>
        {specs.length > 0 && (
          <dl className="space-y-0.5">
            {specs.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3 text-xs">
                <dt className="text-faint">{label}</dt>
                <dd className="font-mono text-muted truncate">{value}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className="text-xs mt-2" aria-live="polite">
          {checkingPreview ? <p className="text-faint">Checking compatibility…</p> : preview ? <>
            <p className={preview.status === 'error' ? 'text-stock-out' : preview.status === 'warning' ? 'text-stock-low' : 'text-stock-in'}>
              {preview.status === 'error' ? 'Incompatible with your selection' : preview.status === 'warning' ? 'Compatibility warning' : 'No conflicts found with selected parts'}
            </p>
            {preview.issues.map((issue, i) => <p key={i} className="mt-1 text-muted leading-relaxed">{issue.message}</p>)}
          </> : <p className="text-faint">Compatibility not checked</p>}
        </div>
        <span className="font-display font-semibold text-ink mt-1">{formatNPR(product.price)}</span>
      </div>
    </button>
  );
}

export default function PartPickerModal({ slot, components, currentProductId, onSelect, onClose }) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('');
  const [page, setPage] = useState(1);
  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [previews, setPreviews] = useState({});
  const [checkingPreview, setCheckingPreview] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const selectionKey = JSON.stringify(components);

  useEffect(() => {
    let cancelled = false;
    setPreviews({}); setPreviewError(false);
    if (loading || !products.length) { setCheckingPreview(false); return; }
    setCheckingPreview(true);
    api.post('/builds/preview-parts', { slot, components: JSON.parse(selectionKey), candidateIds: products.map(p => p._id) })
      .then(({ data }) => { if (!cancelled) setPreviews(data.previews); })
      .catch(() => { if (!cancelled) setPreviewError(true); })
      .finally(() => { if (!cancelled) setCheckingPreview(false); });
    return () => { cancelled = true; };
  }, [slot, selectionKey, products, loading]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get('/products', { params: { category: slot, search, sort, page, limit: 12 } })
      .then(({ data }) => {
        if (cancelled) return;
        setProducts(data.products);
        setMeta({ total: data.total, pages: data.pages });
        setError(null);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [slot, search, sort, page]);

  useEffect(() => {
    setPage(1);
  }, [search, sort]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-base/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-3xl max-h-[85vh] flex flex-col bg-surface border border-border rounded-t-lg sm:rounded overflow-hidden">
        <div className="flex items-center justify-between gap-4 p-4 border-b border-border-soft shrink-0">
          <h2 className="font-display text-lg font-semibold text-ink">
            Choose {CATEGORY_LABELS[slot] || slot}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-faint hover:text-ink p-1">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-3 p-4 border-b border-border-soft shrink-0">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${CATEGORY_LABELS[slot] || ''}…`}
            className="input-field flex-1"
          />
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="input-field font-body shrink-0">
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-xs text-muted mb-3">Compatibility is checked against your selected parts. Red indicates a conflict; yellow indicates a warning. You can still choose a part to revise your build.</p>
          {previewError && <p className="text-xs text-stock-low mb-3">Compatibility previews are unavailable. Your build will be checked after selection.</p>}
          {error && <p className="text-sm text-stock-out mb-4">{error}</p>}

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-[3/4] rounded border border-border-soft bg-raised animate-pulse" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="border border-border-soft rounded p-10 text-center">
              <p className="text-ink font-medium">No matches.</p>
              <p className="text-sm text-faint mt-1">Try a different search term.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {products.map((p) => (
                <PickerCard
                  key={p._id}
                  product={p}
                  preview={previews[p._id]}
                  checkingPreview={checkingPreview}
                  onSelect={onSelect}
                />
              ))}
            </div>
          )}

          <Pagination page={page} pages={meta.pages} onChange={setPage} />
        </div>

        {currentProductId && (
          <div className="p-4 border-t border-border-soft shrink-0">
            <button type="button" onClick={() => onSelect(null)} className="text-xs text-faint hover:text-stock-out">
              Remove current selection instead
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
