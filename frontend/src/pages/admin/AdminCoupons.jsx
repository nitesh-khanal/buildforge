import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { formatNPR } from '../../utils/format';
import Pagination from '../../components/Pagination';
import CouponFormModal from '../../components/admin/CouponFormModal';
import ConfirmDialog from '../../components/admin/ConfirmDialog';

function couponStatus(coupon) {
  const now = new Date();
  if (!coupon.isActive) return { label: 'Inactive', tone: 'text-faint' };
  if (new Date(coupon.expiryDate) < now) return { label: 'Expired', tone: 'text-stock-out' };
  if (coupon.startDate && new Date(coupon.startDate) > now) return { label: 'Scheduled', tone: 'text-stock-low' };
  return { label: 'Active', tone: 'text-stock-in' };
}

function discountLabel(coupon) {
  return coupon.discountType === 'percentage'
    ? `${coupon.discountValue}%${coupon.maxDiscountAmount ? ` (up to ${formatNPR(coupon.maxDiscountAmount)})` : ''}`
    : formatNPR(coupon.discountValue);
}

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [editing, setEditing] = useState(null); // coupon being edited, or {} for create
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [toggleBusy, setToggleBusy] = useState(null);

  function load() {
    setLoading(true);
    setError(null);
    const params = { page, limit: 20 };
    if (search) params.search = search;
    if (status) params.status = status;
    api
      .get('/admin/coupons', { params })
      .then(({ data }) => {
        setCoupons(data.coupons);
        setMeta({ total: data.total, page: data.page, pages: data.pages });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status]);

  function handleSearchSubmit(e) {
    e.preventDefault();
    setPage(1);
    load();
  }

  function handleSaved(coupon) {
    setEditing(null);
    setCoupons((prev) => {
      const exists = prev.some((c) => c._id === coupon._id);
      return exists ? prev.map((c) => (c._id === coupon._id ? coupon : c)) : [coupon, ...prev];
    });
  }

  async function handleToggle(coupon) {
    setToggleBusy(coupon._id);
    try {
      const { data } = await api.patch(`/admin/coupons/${coupon._id}/toggle`);
      setCoupons((prev) => prev.map((c) => (c._id === coupon._id ? data.coupon : c)));
    } catch (err) {
      setError(err.message);
    } finally {
      setToggleBusy(null);
    }
  }

  async function handleDelete() {
    setDeleteBusy(true);
    try {
      await api.delete(`/admin/coupons/${deleting._id}`);
      setCoupons((prev) => prev.filter((c) => c._id !== deleting._id));
      setDeleting(null);
    } catch (err) {
      setError(err.message);
      setDeleting(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 min-w-[240px] max-w-md">
          <input
            className="input-field flex-1 font-mono uppercase"
            placeholder="Search by code…"
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
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="expired">Expired</option>
          </select>
          <button type="button" onClick={() => setEditing({})} className="btn-primary py-2 px-4 text-sm">
            Create coupon
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
                <th className="px-4 py-3 font-normal">Code</th>
                <th className="px-4 py-3 font-normal">Discount</th>
                <th className="px-4 py-3 font-normal">Min order</th>
                <th className="px-4 py-3 font-normal">Usage</th>
                <th className="px-4 py-3 font-normal">Expires</th>
                <th className="px-4 py-3 font-normal">Status</th>
                <th className="px-4 py-3 font-normal text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-faint">
                    Loading…
                  </td>
                </tr>
              ) : coupons.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-faint">
                    No coupons match.
                  </td>
                </tr>
              ) : (
                coupons.map((c) => {
                  const s = couponStatus(c);
                  return (
                    <tr key={c._id} className="border-b border-border-soft last:border-b-0">
                      <td className="px-4 py-3 font-mono text-ink whitespace-nowrap">{c.code}</td>
                      <td className="px-4 py-3 text-muted whitespace-nowrap">{discountLabel(c)}</td>
                      <td className="px-4 py-3 font-mono text-muted whitespace-nowrap">
                        {c.minOrderAmount ? formatNPR(c.minOrderAmount) : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted whitespace-nowrap">
                        {c.usedCount}
                        {c.usageLimit ? ` / ${c.usageLimit}` : ''}
                      </td>
                      <td className="px-4 py-3 text-muted whitespace-nowrap">
                        {new Date(c.expiryDate).toLocaleDateString('en-NP', { dateStyle: 'medium' })}
                      </td>
                      <td className={`px-4 py-3 whitespace-nowrap ${s.tone}`}>{s.label}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => handleToggle(c)}
                            disabled={toggleBusy === c._id}
                            className="text-xs text-muted hover:text-ink transition-colors disabled:opacity-40"
                          >
                            {toggleBusy === c._id ? '…' : c.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                          <button type="button" onClick={() => setEditing(c)} className="text-xs text-muted hover:text-ink transition-colors">
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleting(c)}
                            className="text-xs text-stock-out hover:brightness-110 transition-all"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={meta.page} pages={meta.pages} onChange={setPage} />

      {editing && <CouponFormModal coupon={editing._id ? editing : null} onClose={() => setEditing(null)} onSaved={handleSaved} />}

      {deleting && (
        <ConfirmDialog
          title="Delete coupon?"
          message={`This permanently removes "${deleting.code}". Coupons that have already been redeemed can't be deleted — deactivate them instead.`}
          confirmLabel="Delete"
          busy={deleteBusy}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
