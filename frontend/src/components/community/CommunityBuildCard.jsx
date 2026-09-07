import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { formatNPR, resolveImageUrl } from '../../utils/format';
import { COMMUNITY_CATEGORY_LABELS } from '../../utils/community';

const STATUS_DOT = {
  compatible: 'bg-stock-in',
  warning: 'bg-stock-low',
  error: 'bg-stock-out',
};

const THUMB_SLOTS = ['cpu', 'gpu', 'motherboard', 'ram', 'storage', 'psu', 'case', 'cpu-cooler'];

export default function CommunityBuildCard({ build }) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [liked, setLiked] = useState(build.isLiked);
  const [likesCount, setLikesCount] = useState(build.likesCount);
  const [busy, setBusy] = useState(false);

  const thumbs = THUMB_SLOTS.map((k) => build.components?.[k]).filter(Boolean).slice(0, 4);

  async function handleLike(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (busy) return;
    setBusy(true);
    // Optimistic — mirrors the wishlist heart's toggle feel, reconciled
    // against the server's authoritative likesCount either way.
    const prevLiked = liked;
    const prevCount = likesCount;
    setLiked(!prevLiked);
    setLikesCount(prevLiked ? prevCount - 1 : prevCount + 1);
    try {
      const { data } = await api.post(`/community/builds/${build._id}/like`);
      setLiked(data.liked);
      setLikesCount(data.likesCount);
    } catch {
      setLiked(prevLiked);
      setLikesCount(prevCount);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Link
      to={`/community/builds/${build._id}`}
      className="flex flex-col border border-border-soft rounded overflow-hidden hover:border-accent transition-colors bg-surface"
    >
      <div className="flex gap-1 p-2 bg-raised">
        {thumbs.length > 0 ? (
          thumbs.map((p) => (
            <div
              key={p._id}
              className="flex-1 aspect-square bg-surface border border-border-soft rounded overflow-hidden flex items-center justify-center"
            >
              <img
                src={resolveImageUrl(p.image)}
                alt={p.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          ))
        ) : (
          <div className="flex-1 aspect-[4/1] flex items-center justify-center text-faint text-xs">No parts</div>
        )}
      </div>

      <div className="p-3 flex-1 flex flex-col">
        <div className="flex items-center gap-2 mb-1">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[build.compatibilityStatus] || 'bg-faint'}`} />
          <span className="text-[11px] font-mono text-faint uppercase tracking-wide">
            {COMMUNITY_CATEGORY_LABELS[build.category] || build.category}
          </span>
        </div>
        <h3 className="text-sm font-medium text-ink truncate">{build.title}</h3>
        <p className="text-xs text-faint mt-0.5">by {build.user?.name || 'a BuildForge user'}</p>

        <div className="flex items-center justify-between mt-auto pt-3">
          <span className="font-mono text-sm text-muted">{formatNPR(build.totalPrice)}</span>
          <div className="flex items-center gap-3 text-xs text-faint">
            <button
              type="button"
              onClick={handleLike}
              aria-label={liked ? 'Unlike' : 'Like'}
              aria-pressed={liked}
              className={`flex items-center gap-1 transition-colors ${liked ? 'text-accent' : 'hover:text-ink'}`}
            >
              <svg
                viewBox="0 0 24 24"
                width="13"
                height="13"
                fill={liked ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="1.6"
              >
                <path d="M12 20.3s-7.5-4.6-9.8-9.2C.7 7.6 2.4 4 6 4c2 0 3.6 1.1 4.5 2.6C11.4 5.1 13 4 15 4c3.6 0 5.3 3.6 3.8 7.1-2.3 4.6-9.8 9.2-9.8 9.2Z" />
              </svg>
              {likesCount}
            </button>
            <span className="flex items-center gap-1">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M21 11.5a8.4 8.4 0 0 1-8.9 8.4 9 9 0 0 1-3.6-.8L3 20l1.1-4.3a8.3 8.3 0 0 1-1-4A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z" />
              </svg>
              {build.commentsCount}
            </span>
            {build.ratingCount > 0 && (
              <span className="flex items-center gap-1 text-accent">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" stroke="none">
                  <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.8L12 3.5Z" />
                </svg>
                {build.averageRating.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
