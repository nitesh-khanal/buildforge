import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import RatingStars from '../review/RatingStars';

// `myRating`/`averageRating`/`ratingCount` come from the build detail
// response (GET /api/community/builds/:id) — this widget doesn't fetch its
// own copy, it just posts changes up via onUpdate so the parent page's
// single source of truth stays in sync.
export default function BuildRatingWidget({ buildId, isOwner, myRating, averageRating, ratingCount, onUpdate }) {
  const { isAuthenticated } = useAuth();
  const [draft, setDraft] = useState(myRating || 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleRate(value) {
    setDraft(value);
    setSaving(true);
    setError(null);
    try {
      const { data } = await api.post(`/community/builds/${buildId}/rating`, { rating: value });
      onUpdate({ myRating: data.rating.rating, averageRating: data.averageRating, ratingCount: data.ratingCount });
    } catch (err) {
      setError(err.message);
      setDraft(myRating || 0);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setSaving(true);
    setError(null);
    try {
      const { data } = await api.delete(`/community/builds/${buildId}/rating`);
      setDraft(0);
      onUpdate({ myRating: null, averageRating: data.averageRating, ratingCount: data.ratingCount });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border border-border-soft rounded p-4">
      <div className="flex items-center gap-3">
        <span className="font-display text-2xl font-semibold text-ink">
          {ratingCount > 0 ? averageRating.toFixed(1) : '—'}
        </span>
        <div>
          <RatingStars value={averageRating || 0} size={15} />
          <p className="text-xs text-faint mt-0.5">
            {ratingCount || 0} rating{ratingCount === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-border-soft">
        {!isAuthenticated ? (
          <p className="text-xs text-faint">
            <Link to="/login" className="text-accent hover:underline">
              Log in
            </Link>{' '}
            to rate this build.
          </p>
        ) : isOwner ? (
          <p className="text-xs text-faint">You can't rate your own build.</p>
        ) : (
          <>
            <p className="text-xs text-faint mb-1.5">{myRating ? 'Your rating' : 'Rate this build'}</p>
            <div className="flex items-center gap-3">
              <RatingStars value={draft} onChange={handleRate} size={20} />
              {myRating ? (
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={saving}
                  className="text-xs text-faint hover:text-stock-out disabled:opacity-50"
                >
                  Remove
                </button>
              ) : null}
            </div>
            {error && <p className="text-xs text-stock-out mt-2">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
