import { useState } from 'react';
import api from '../../lib/api';
import RatingStars from './RatingStars';

export default function ReviewForm({ productId, existingReview, onSaved, onCancel }) {
  const [rating, setRating] = useState(existingReview?.rating || 0);
  const [title, setTitle] = useState(existingReview?.title || '');
  const [comment, setComment] = useState(existingReview?.comment || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!rating) {
      setError('Pick a star rating first.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const method = existingReview ? 'put' : 'post';
      const { data } = await api[method](`/products/${productId}/reviews`, { rating, title, comment });
      onSaved(data.review);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border border-border-soft rounded p-4 flex flex-col gap-3">
      <div>
        <label className="block text-xs text-faint mb-1.5">Your rating</label>
        <RatingStars value={rating} onChange={setRating} size={22} />
      </div>

      <div>
        <label className="block text-xs text-faint mb-1.5">Title (optional)</label>
        <input
          className="input-field w-full"
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Sum it up in a few words"
        />
      </div>

      <div>
        <label className="block text-xs text-faint mb-1.5">Review (optional)</label>
        <textarea
          className="input-field w-full min-h-[90px] resize-y"
          value={comment}
          maxLength={2000}
          onChange={(e) => setComment(e.target.value)}
          placeholder="What did you like or dislike?"
        />
      </div>

      {error && <p className="text-sm text-stock-out">{error}</p>}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="btn-primary py-2 px-4 text-sm disabled:opacity-50">
          {saving ? 'Saving…' : existingReview ? 'Update review' : 'Submit review'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-sm text-muted hover:text-ink">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
