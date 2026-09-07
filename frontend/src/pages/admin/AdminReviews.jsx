import { useEffect, useState } from 'react';
import api from '../../lib/api';
import Pagination from '../../components/Pagination';
import RatingStars from '../../components/review/RatingStars';

export default function AdminReviews() {
  const [reviews, setReviews] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1 });
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [reasonDraft, setReasonDraft] = useState({});

  function load() {
    setLoading(true);
    setError(null);
    const params = { page, limit: 20 };
    if (status) params.status = status;
    api
      .get('/admin/reviews', { params })
      .then(({ data }) => {
        setReviews(data.reviews);
        setMeta({ total: data.total, page: data.page, pages: data.pages });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status]);

  async function handleHide(review) {
    setBusyId(review._id);
    try {
      const { data } = await api.patch(`/admin/reviews/${review._id}/hide`, {
        reason: reasonDraft[review._id] || '',
      });
      setReviews((prev) => prev.map((r) => (r._id === review._id ? data.review : r)));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleUnhide(review) {
    setBusyId(review._id);
    try {
      const { data } = await api.patch(`/admin/reviews/${review._id}/unhide`);
      setReviews((prev) => prev.map((r) => (r._id === review._id ? data.review : r)));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="input-field"
        >
          <option value="">All reviews</option>
          <option value="visible">Visible</option>
          <option value="hidden">Hidden</option>
        </select>
        <span className="text-xs text-faint">{meta.total} total</span>
      </div>

      {error && (
        <p className="text-sm text-stock-out bg-accent-soft/40 border border-stock-out/40 rounded px-3 py-2 mb-4">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-faint">Loading…</p>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-faint">No reviews match.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {reviews.map((r) => (
            <div key={r._id} className="border border-border-soft rounded p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <RatingStars value={r.rating} size={14} />
                    {r.title && <span className="font-medium text-ink text-sm">{r.title}</span>}
                    <span
                      className={`text-[11px] font-mono rounded px-1.5 py-0.5 border ${
                        r.status === 'hidden'
                          ? 'text-stock-out border-stock-out/40'
                          : 'text-accent border-accent/40'
                      }`}
                    >
                      {r.status}
                    </span>
                    {r.verifiedPurchase && (
                      <span className="text-[11px] font-mono text-faint">Verified purchase</span>
                    )}
                  </div>
                  {r.comment && <p className="text-sm text-muted mt-2 leading-relaxed">{r.comment}</p>}
                  <p className="text-xs text-faint mt-2">
                    {r.user?.name || 'Unknown user'} ({r.user?.email}) on {r.product?.name || 'a deleted product'} ·{' '}
                    {new Date(r.createdAt).toLocaleDateString('en-NP', { dateStyle: 'medium' })}
                  </p>
                  {r.status === 'hidden' && r.moderationReason && (
                    <p className="text-xs text-faint mt-1 italic">Reason: {r.moderationReason}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {r.status === 'visible' ? (
                    <>
                      <input
                        className="input-field text-xs py-1.5 w-40"
                        placeholder="Reason (optional)"
                        value={reasonDraft[r._id] || ''}
                        onChange={(e) => setReasonDraft((prev) => ({ ...prev, [r._id]: e.target.value }))}
                      />
                      <button
                        type="button"
                        onClick={() => handleHide(r)}
                        disabled={busyId === r._id}
                        className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40"
                      >
                        {busyId === r._id ? 'Hiding…' : 'Hide'}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleUnhide(r)}
                      disabled={busyId === r._id}
                      className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40"
                    >
                      {busyId === r._id ? 'Restoring…' : 'Unhide'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Pagination page={meta.page} pages={meta.pages} onChange={setPage} />
    </div>
  );
}
