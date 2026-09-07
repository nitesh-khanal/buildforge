import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import ProductCard from '../components/ProductCard';
import FilterSidebar from '../components/FilterSidebar';
import Pagination from '../components/Pagination';
import { CATEGORY_LABELS } from '../utils/specs';

const SORT_OPTIONS = [
  { value: '', label: 'Newest' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Top rated' },
  { value: 'name', label: 'Name A–Z' },
];

const EMPTY_FILTERS = { category: '', brand: '', minPrice: '', maxPrice: '', rating: '', availability: '', search: '', sort: '', page: '1' };

export default function Shop() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const filters = useMemo(() => {
    const f = { ...EMPTY_FILTERS };
    for (const key of Object.keys(EMPTY_FILTERS)) {
      if (searchParams.get(key)) f[key] = searchParams.get(key);
    }
    return f;
  }, [searchParams]);

  const applyFilters = useCallback(
    (next, { keepPage = false } = {}) => {
      const params = {};
      Object.entries(next).forEach(([key, value]) => {
        if (value) params[key] = value;
      });
      if (!keepPage) delete params.page;
      setSearchParams(params);
    },
    [setSearchParams]
  );

  useEffect(() => {
    api.get('/categories').then(({ data }) => setCategories(data.categories));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = { ...filters, limit: 24 };
    api
      .get('/products', { params })
      .then(({ data }) => {
        if (cancelled) return;
        setProducts(data.products);
        setMeta({ total: data.total, page: data.page, pages: data.pages });
        setError(null);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [filters]);

  const activeCategoryLabel = filters.category ? CATEGORY_LABELS[filters.category] : null;

  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold text-ink">
          {filters.search ? `Results for “${filters.search}”` : activeCategoryLabel || 'All parts'}
        </h1>
        <p className="text-sm text-faint mt-1">
          {loading ? 'Loading…' : `${meta.total} ${meta.total === 1 ? 'result' : 'results'}`}
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-10">
        <FilterSidebar
          filters={filters}
          categories={categories}
          onChange={applyFilters}
          onReset={() => setSearchParams({})}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-end mb-5">
            <select
              value={filters.sort}
              onChange={(e) => applyFilters({ ...filters, sort: e.target.value })}
              className="input-field font-body"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-stock-out mb-4">{error}</p>}

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-[3/4] rounded border border-border-soft bg-surface animate-pulse" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="border border-border-soft rounded p-12 text-center">
              <p className="text-ink font-medium">No parts match those filters.</p>
              <p className="text-sm text-faint mt-1">Try widening the price range or clearing a filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {products.map((p) => (
                <ProductCard key={p._id} product={p} />
              ))}
            </div>
          )}

          <Pagination
            page={meta.page}
            pages={meta.pages}
            onChange={(p) => applyFilters({ ...filters, page: String(p) }, { keepPage: true })}
          />
        </div>
      </div>
    </div>
  );
}
