import { useEffect, useRef, useState } from 'react';
import api from '../../lib/api';
import { formatNPR, resolveImageUrl } from '../../utils/format';

// Phase 10: a reusable searchable multi-select for picking specific products
// by id — first used by CouponFormModal for `applicableProducts` (the
// backend/couponService.js has fully supported this since Phase 5; only the
// admin UI had no product picker yet, per BUILD_FORGE_PROGRESS.md's "Known
// bugs" section). Deliberately generic (id/name/price/image in, id array
// out) so `ProductFormModal`'s eventual "related products" field or any
// other future admin picker can reuse it instead of building its own.
export default function ProductPickerField({ selectedIds, onChange, label }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const debounceRef = useRef(null);

  // Resolve display info (name/price/image) for ids the caller already has
  // selected (e.g. loading an existing coupon for edit) — one-time per
  // mount, then kept in sync locally as items are added/removed below.
  useEffect(() => {
    if (!selectedIds || selectedIds.length === 0) {
      setSelectedProducts([]);
      return;
    }
    let cancelled = false;
    api
      .get('/admin/products', { params: { limit: 60, ids: selectedIds.join(',') } })
      .then(({ data }) => {
        if (cancelled) return;
        // Fallback: the admin listing endpoint doesn't support an `ids`
        // filter, so just match locally against a broad fetch — fine at
        // this project's product-catalog scale (~40 seeded products).
        const bySelected = data.products.filter((p) => selectedIds.includes(p._id));
        setSelectedProducts(bySelected);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(() => {
      api
        .get('/admin/products', { params: { search: query.trim(), limit: 10 } })
        .then(({ data }) => setResults(data.products))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  function addProduct(product) {
    if (selectedIds.includes(product._id)) return;
    onChange([...selectedIds, product._id]);
    setSelectedProducts((prev) => [...prev, product]);
    setQuery('');
    setResults([]);
  }

  function removeProduct(id) {
    onChange(selectedIds.filter((existing) => existing !== id));
    setSelectedProducts((prev) => prev.filter((p) => p._id !== id));
  }

  return (
    <div>
      {label && <span className="text-xs text-muted">{label}</span>}

      {selectedProducts.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2 mb-2">
          {selectedProducts.map((p) => (
            <span
              key={p._id}
              className="inline-flex items-center gap-1.5 text-xs font-mono px-2 py-1 rounded border border-accent text-accent bg-accent-soft/30"
            >
              {p.name}
              <button
                type="button"
                onClick={() => removeProduct(p._id)}
                aria-label={`Remove ${p.name}`}
                className="hover:brightness-125"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <input
          className="input-field w-full mt-1"
          placeholder="Search products by name or brand…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query.trim() && (
          <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto bg-surface border border-border-soft rounded shadow-lg">
            {searching ? (
              <p className="px-3 py-2 text-xs text-faint">Searching…</p>
            ) : results.length === 0 ? (
              <p className="px-3 py-2 text-xs text-faint">No matches.</p>
            ) : (
              results.map((p) => (
                <button
                  key={p._id}
                  type="button"
                  onClick={() => addProduct(p)}
                  disabled={selectedIds.includes(p._id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-canvas transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  <div className="w-6 h-6 shrink-0 bg-canvas border border-border-soft rounded overflow-hidden">
                    {p.image && <img src={resolveImageUrl(p.image)} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <span className="flex-1 text-ink truncate">{p.name}</span>
                  <span className="text-faint font-mono">{formatNPR(p.price)}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
