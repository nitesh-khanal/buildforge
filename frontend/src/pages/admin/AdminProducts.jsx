import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { formatNPR, resolveImageUrl } from '../../utils/format';
import { CATEGORY_LABELS } from '../../utils/specs';
import Pagination from '../../components/Pagination';
import StockBadge from '../../components/StockBadge';
import ProductFormModal from '../../components/admin/ProductFormModal';
import ConfirmDialog from '../../components/admin/ConfirmDialog';

const CATEGORIES = Object.entries(CATEGORY_LABELS);

function stockStatus(stock) {
  if (stock <= 0) return 'out-of-stock';
  if (stock <= 3) return 'low-stock';
  return 'in-stock';
}

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1 });
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('active'); // Phase 10: 'active' | 'archived' | 'all'
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [editing, setEditing] = useState(null); // product being edited, or {} for create
  const [archiving, setArchiving] = useState(null);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(null);
  const [stockEdits, setStockEdits] = useState({}); // productId -> draft string
  const [stockBusy, setStockBusy] = useState(null);

  function load() {
    setLoading(true);
    setError(null);
    const params = { page, limit: 20, status };
    if (search) params.search = search;
    if (category) params.category = category;
    api
      .get('/admin/products', { params })
      .then(({ data }) => {
        setProducts(data.products);
        setMeta({ total: data.total, page: data.page, pages: data.pages });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, category, status]);

  function handleSearchSubmit(e) {
    e.preventDefault();
    setPage(1);
    load();
  }

  function handleSaved(product) {
    setEditing(null);
    setProducts((prev) => {
      const exists = prev.some((p) => p._id === product._id);
      return exists ? prev.map((p) => (p._id === product._id ? product : p)) : [product, ...prev];
    });
  }

  async function handleArchive() {
    setArchiveBusy(true);
    try {
      const { data } = await api.delete(`/admin/products/${archiving._id}`);
      // Archiving with status='active' filtering means the row should drop
      // out of the current list; with status='all'/'archived' it should
      // just flip to showing the archived badge in place — either way,
      // re-syncing from the response covers both without a special case.
      setProducts((prev) =>
        status === 'active' ? prev.filter((p) => p._id !== archiving._id) : prev.map((p) => (p._id === archiving._id ? data.product : p))
      );
      setArchiving(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setArchiveBusy(false);
    }
  }

  async function handleRestore(product) {
    setRestoreBusy(product._id);
    try {
      const { data } = await api.patch(`/admin/products/${product._id}/restore`);
      setProducts((prev) =>
        status === 'archived' ? prev.filter((p) => p._id !== product._id) : prev.map((p) => (p._id === product._id ? data.product : p))
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setRestoreBusy(null);
    }
  }

  async function saveStock(product) {
    const raw = stockEdits[product._id];
    const value = Number(raw);
    if (raw === undefined || Number.isNaN(value) || value < 0) return;
    setStockBusy(product._id);
    try {
      const { data } = await api.patch(`/admin/products/${product._id}/stock`, { stock: value });
      setProducts((prev) => prev.map((p) => (p._id === product._id ? data.product : p)));
      setStockEdits((prev) => {
        const next = { ...prev };
        delete next[product._id];
        return next;
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setStockBusy(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 min-w-[240px] max-w-md">
          <input
            className="input-field flex-1"
            placeholder="Search by name or brand…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="btn-secondary py-2 px-3 text-xs">
            Search
          </button>
        </form>
        <div className="flex items-center gap-2">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="input-field"
          >
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </select>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            className="input-field"
          >
            <option value="">All categories</option>
            {CATEGORIES.map(([slug, label]) => (
              <option key={slug} value={slug}>
                {label}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => setEditing({})} className="btn-primary py-2 px-4 text-sm">
            Add product
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-stock-out bg-accent-soft/40 border border-stock-out/40 rounded px-3 py-2 mb-4">{error}</p>
      )}

      <div className="border border-border-soft rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-soft text-left text-xs text-muted">
                <th className="px-4 py-3 font-normal">Product</th>
                <th className="px-4 py-3 font-normal">Category</th>
                <th className="px-4 py-3 font-normal">Price</th>
                <th className="px-4 py-3 font-normal">Stock</th>
                <th className="px-4 py-3 font-normal">Featured</th>
                <th className="px-4 py-3 font-normal text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-faint">
                    Loading…
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-faint">
                    No products match.
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p._id} className="border-b border-border-soft last:border-b-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-[220px]">
                        <div className="w-10 h-10 shrink-0 bg-surface border border-border-soft rounded overflow-hidden flex items-center justify-center">
                          {p.image ? (
                            <img src={resolveImageUrl(p.image)} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[9px] text-faint">None</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-ink truncate">
                            {p.name}
                            {p.isArchived && (
                              <span className="ml-2 text-[10px] uppercase tracking-wide text-faint border border-border-soft rounded px-1.5 py-0.5">
                                Archived
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-faint">{p.brand}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted whitespace-nowrap">{CATEGORY_LABELS[p.category] || p.category}</td>
                    <td className="px-4 py-3 font-mono text-ink whitespace-nowrap">{formatNPR(p.price)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <StockBadge status={stockStatus(p.stock)} stock={p.stock} />
                        <input
                          type="number"
                          min="0"
                          className="input-field w-16 py-1 px-2 text-xs"
                          placeholder={String(p.stock)}
                          value={stockEdits[p._id] ?? ''}
                          onChange={(e) => setStockEdits((prev) => ({ ...prev, [p._id]: e.target.value }))}
                        />
                        <button
                          type="button"
                          onClick={() => saveStock(p)}
                          disabled={stockEdits[p._id] === undefined || stockEdits[p._id] === '' || stockBusy === p._id}
                          className="text-xs text-accent hover:text-accent-hover transition-colors disabled:opacity-30 disabled:pointer-events-none"
                        >
                          {stockBusy === p._id ? '…' : 'Set'}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted">{p.isFeatured ? 'Yes' : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-3">
                        <button type="button" onClick={() => setEditing(p)} className="text-xs text-muted hover:text-ink transition-colors">
                          Edit
                        </button>
                        {p.isArchived ? (
                          <button
                            type="button"
                            onClick={() => handleRestore(p)}
                            disabled={restoreBusy === p._id}
                            className="text-xs text-accent hover:text-accent-hover transition-colors disabled:opacity-40"
                          >
                            {restoreBusy === p._id ? '…' : 'Restore'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setArchiving(p)}
                            className="text-xs text-stock-out hover:brightness-110 transition-all"
                          >
                            Archive
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={meta.page} pages={meta.pages} onChange={setPage} />

      {editing && <ProductFormModal product={editing._id ? editing : null} onClose={() => setEditing(null)} onSaved={handleSaved} />}

      {archiving && (
        <ConfirmDialog
          title="Archive product?"
          message={`"${archiving.name}" will be hidden from the storefront and can no longer be added to a cart, but stays visible here (and can be restored any time) and existing orders referencing it are unaffected.`}
          confirmLabel="Archive"
          busy={archiveBusy}
          onConfirm={handleArchive}
          onCancel={() => setArchiving(null)}
        />
      )}
    </div>
  );
}
