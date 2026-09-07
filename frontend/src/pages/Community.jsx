import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import Pagination from '../components/Pagination';
import CommunityBuildCard from '../components/community/CommunityBuildCard';
import { COMMUNITY_CATEGORIES } from '../utils/community';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'popular', label: 'Most liked' },
  { value: 'top-rated', label: 'Top rated' },
  { value: 'most-viewed', label: 'Most viewed' },
];

const EMPTY_FILTERS = { category: '', search: '', sort: 'newest', page: '1' };

export default function Community() {
  const { isAuthenticated } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [builds, setBuilds] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchInput, setSearchInput] = useState('');

  const filters = useMemo(() => {
    const f = { ...EMPTY_FILTERS };
    for (const key of Object.keys(EMPTY_FILTERS)) {
      if (searchParams.get(key)) f[key] = searchParams.get(key);
    }
    return f;
  }, [searchParams]);

  useEffect(() => setSearchInput(filters.search), [filters.search]);

  const applyFilters = useCallback(
    (next, { keepPage = false } = {}) => {
      const params = {};
      Object.entries(next).forEach(([key, value]) => {
        if (value && !(key === 'sort' && value === 'newest')) params[key] = value;
      });
      if (!keepPage) delete params.page;
      setSearchParams(params);
    },
    [setSearchParams]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get('/community/builds', { params: { ...filters, limit: 12 } })
      .then(({ data }) => {
        if (cancelled) return;
        setBuilds(data.builds);
        setMeta({ total: data.total, page: data.page, pages: data.pages });
        setError(null);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [filters]);

  function handleSearchSubmit(e) {
    e.preventDefault();
    applyFilters({ ...filters, search: searchInput.trim() });
  }

  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Community builds</h1>
          <p className="text-sm text-faint mt-1">Browse builds other BuildForge customers have shared.</p>
        </div>
        {isAuthenticated && (
          <Link to="/community/mine" className="btn-secondary py-2 px-4 text-sm">
            My posts
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[200px] max-w-sm">
          <input
            className="input-field w-full"
            placeholder="Search builds…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </form>
        <select
          value={filters.category}
          onChange={(e) => applyFilters({ ...filters, category: e.target.value })}
          className="input-field"
        >
          <option value="">All categories</option>
          {COMMUNITY_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          value={filters.sort}
          onChange={(e) => applyFilters({ ...filters, sort: e.target.value })}
          className="input-field"
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
            <div key={i} className="aspect-[4/5] rounded border border-border-soft bg-surface animate-pulse" />
          ))}
        </div>
      ) : builds.length === 0 ? (
        <div className="border border-border-soft rounded p-12 text-center">
          <p className="text-ink font-medium">No community builds match yet.</p>
          <p className="text-sm text-faint mt-1">Be the first to publish one from the PC Builder.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
          {builds.map((b) => (
            <CommunityBuildCard key={b._id} build={b} />
          ))}
        </div>
      )}

      <Pagination
        page={meta.page}
        pages={meta.pages}
        onChange={(p) => applyFilters({ ...filters, page: String(p) }, { keepPage: true })}
      />
    </div>
  );
}
