import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import RatingStars from './RatingStars';
import ReviewForm from './ReviewForm';

function DistributionBars({ distribution, numReviews }) {
  if (!distribution || !numReviews) return null;
  const counts = [5, 4, 3, 2, 1].map((star) => Number(distribution[star] ?? distribution[String(star)] ?? 0));

  return (
    <div className="flex flex-col gap-1 w-full max-w-xs">
      {[5, 4, 3, 2, 1].map((star, i) => {
        const count = counts[i];
        const pct = numReviews ? Math.round((count / numReviews) * 100) : 0;
        return (
          <div key={star} className="flex items-center gap-2 text-xs text-faint">
            <span className="w-3 font-mono">{star}</span>
            <div className="flex-1 h-1.5 rounded-full bg-raised overflow-hidden">
              <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
            </div>
            <span className="w-6 font-mono text-right">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function ReviewsSection({ productId }) {
  const { isAuthenticated } = useAuth();

  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [sort, setSort] = useState('newest');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [myReview, setMyReview] = useState(null);
  const [verifiedPurchase, setVerifiedPurchase] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function loadReviews() {
    setLoading(true);
    api
      .get(`/products/${productId}/reviews`, { params: { page, sort } })
      .then(({ data }) => {
        setReviews(data.reviews);
        setPages(data.pages);
        setSummary(data.summary);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, page, sort]);

  useEffect(() => {
    if (!isAuthenticated) {
      setMyReview(null);
      setVerifiedPurchase(false);
      return;
    }
    api
      .get(`/products/${productId}/reviews/mine`)
      .then(({ data }) => {
        setMyReview(data.review);
        setVerifiedPurchase(data.verifiedPurchase);
      })
      .catch(() => {});
  }, [productId, isAuthenticated]);

  function handleSaved(review) {
    setMyReview(review);
    setShowForm(false);
    setPage(1);
    loadReviews();
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.delete(`/products/${productId}/reviews`);
      setMyReview(null);
      loadReviews();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="mt-16">
      <h2 className="font-display text-lg font-semibold text-ink mb-6">Reviews</h2>

      <div className="flex flex-col sm:flex-row gap-8 mb-8">
        <div className="flex items-center gap-4 shrink-0">
          <span className="font-display text-3xl font-semibold text-ink">
            {summary?.rating ? summary.rating.toFixed(1) : '—'}
          </span>
          <div>
            <RatingStars value={summary?.rating || 0} size={16} />
            <p className="text-xs text-faint mt-1">
              {summary?.numReviews || 0} review{summary?.numReviews === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <DistributionBars distribution={summary?.ratingDistribution} numReviews={summary?.numReviews} />
      </div>

      {isAuthenticated ? (
        myReview && !showForm ? (
          <div className="border border-border-soft rounded p-4 mb-8 bg-raised/40">
            <p className="text-sm text-muted mb-2">
              You reviewed this product{verifiedPurchase ? ' (verified purchase)' : ''}.
            </p>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setShowForm(true)} className="btn-secondary py-1.5 px-3 text-xs">
                Edit review
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="text-xs text-stock-out hover:underline disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        ) : !myReview && !showForm ? (
          <button type="button" onClick={() => setShowForm(true)} className="btn-secondary py-2 px-4 text-sm mb-8">
            Write a review
          </button>
        ) : (
          <div className="mb-8">
            <ReviewForm
              productId={productId}
              existingReview={myReview}
              onSaved={handleSaved}
              onCancel={() => setShowForm(false)}
            />
          </div>
        )
      ) : (
        <p className="text-sm text-faint mb-8">
          <a href="/login" className="text-accent hover:underline">
            Log in
          </a>{' '}
          to write a review.
        </p>
      )}

      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-faint">Sorted by</span>
        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            setPage(1);
          }}
          className="input-field text-xs py-1.5"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="highest">Highest rated</option>
          <option value="lowest">Lowest rated</option>
        </select>
      </div>

      {error && <p className="text-sm text-stock-out mb-4">{error}</p>}

      {loading ? (
        <p className="text-sm text-faint">Loading reviews…</p>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-faint">No reviews yet — be the first.</p>
      ) : (
        <div className="flex flex-col divide-y divide-border-soft">
          {reviews.map((r) => (
            <div key={r._id} className="py-4">
              <div className="flex items-center gap-2 flex-wrap">
                <RatingStars value={r.rating} size={14} />
                {r.title && <span className="font-medium text-ink text-sm">{r.title}</span>}
                {r.verifiedPurchase && (
                  <span className="text-[11px] font-mono text-accent border border-accent/40 rounded px-1.5 py-0.5">
                    Verified purchase
                  </span>
                )}
              </div>
              {r.comment && <p className="text-sm text-muted mt-2 leading-relaxed">{r.comment}</p>}
              <p className="text-xs text-faint mt-2">
                {r.user?.name || 'BuildForge customer'} ·{' '}
                {new Date(r.createdAt).toLocaleDateString('en-NP', { dateStyle: 'medium' })}
              </p>
            </div>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center gap-2 mt-6">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40"
          >
            Prev
          </button>
          <span className="text-xs text-faint">
            Page {page} of {pages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page >= pages}
            className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
