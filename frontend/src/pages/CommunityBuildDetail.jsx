import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { formatNPR } from '../utils/format';
import { COMMUNITY_CATEGORY_LABELS } from '../utils/community';
import BuildComponentsList from '../components/community/BuildComponentsList';
import BuildRatingWidget from '../components/community/BuildRatingWidget';
import CommentThread from '../components/community/CommentThread';
import ReportModal from '../components/community/ReportModal';
import PublishBuildModal from '../components/community/PublishBuildModal';
import ConfirmDialog from '../components/admin/ConfirmDialog';

const STATUS_LABEL = { compatible: 'Compatible', warning: 'Minor warnings', error: 'Compatibility error' };
const STATUS_COLOR = { compatible: 'text-stock-in', warning: 'text-stock-low', error: 'text-stock-out' };

export default function CommunityBuildDetail() {
  const { id } = useParams();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [build, setBuild] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);

  const { addCustomBuild } = useCart();

  const [liking, setLiking] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Phase 8 — Community → PC Builder → Cart. `copyResult` holds the fresh,
  // just-recomputed snapshot from POST /community/builds/:id/copy once the
  // user asks to copy the build; nothing is fetched until they do.
  const [copying, setCopying] = useState(false);
  const [copyResult, setCopyResult] = useState(null);
  const [addingToCart, setAddingToCart] = useState(false);

  function load() {
    setLoading(true);
    api
      .get(`/community/builds/${id}`)
      .then(({ data }) => {
        setBuild(data.build);
        setError(null);
      })
      .catch((err) => {
        setNotFound(true);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleLike() {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (liking) return;
    setLiking(true);
    try {
      const { data } = await api.post(`/community/builds/${id}/like`);
      setBuild((prev) => ({ ...prev, isLiked: data.liked, likesCount: data.likesCount }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLiking(false);
    }
  }

  // Recomputes compatibility/prices fresh (they may have drifted since this
  // was posted) and hands back a snapshot to either continue editing in the
  // /build page or add straight to cart — the backend owns the copiesCount
  // increment either way. Guests can copy too, same as the builder itself.
  async function handleCopy() {
    setCopying(true);
    setError(null);
    try {
      const { data } = await api.post(`/community/builds/${id}/copy`);
      setBuild((prev) => ({ ...prev, copiesCount: data.copiesCount }));
      setCopyResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setCopying(false);
    }
  }

  function handleEditInBuilder() {
    navigate('/build', {
      state: {
        loadBuild: {
          components: copyResult.components,
          name: build.title,
          reportStatus: copyResult.report.status,
        },
      },
    });
  }

  async function handleAddToCart() {
    setAddingToCart(true);
    setError(null);
    try {
      const components = Object.values(copyResult.components)
        .filter(Boolean)
        .map((p) => ({ productId: p._id }));
      const res = await addCustomBuild(components);
      if (res.ok) {
        navigate('/cart');
      } else {
        setError(res.message);
      }
    } finally {
      setAddingToCart(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.delete(`/community/builds/${id}`);
      navigate('/community/mine');
    } catch (err) {
      setError(err.message);
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  if (loading) {
    return <div className="max-w-content mx-auto px-4 sm:px-6 py-24 text-center text-sm text-faint">Loading…</div>;
  }

  if (notFound || !build) {
    return (
      <div className="max-w-content mx-auto px-4 sm:px-6 py-24 text-center">
        <p className="text-ink font-medium">{error || 'This build could not be found.'}</p>
        <Link to="/community" className="text-accent hover:underline text-sm mt-2 inline-block">
          Back to community builds
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 py-10">
      <div className="flex flex-col lg:flex-row gap-10 items-start">
        <div className="flex-1 min-w-0 w-full">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-mono text-faint uppercase tracking-wide">
              {COMMUNITY_CATEGORY_LABELS[build.category] || build.category}
            </span>
            <span className={`text-[11px] font-mono ${STATUS_COLOR[build.compatibilityStatus] || 'text-faint'}`}>
              · {STATUS_LABEL[build.compatibilityStatus] || build.compatibilityStatus}
            </span>
            {build.visibility !== 'public' && (
              <span className="text-[11px] font-mono text-faint border border-border-soft rounded px-1.5 py-0.5">
                {build.visibility}
              </span>
            )}
          </div>

          <h1 className="font-display text-2xl font-semibold text-ink">{build.title}</h1>
          <p className="text-sm text-faint mt-1">
            by {build.user?.name || 'a BuildForge user'} ·{' '}
            {new Date(build.createdAt).toLocaleDateString('en-NP', { dateStyle: 'medium' })} · {build.viewsCount}{' '}
            view{build.viewsCount === 1 ? '' : 's'}
          </p>

          {build.description && <p className="text-sm text-muted mt-4 leading-relaxed whitespace-pre-wrap">{build.description}</p>}

          {build.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {build.tags.map((t) => (
                <span key={t} className="text-[11px] font-mono text-faint border border-border-soft rounded px-1.5 py-0.5">
                  #{t}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-4 mt-5">
            <button
              type="button"
              onClick={handleLike}
              disabled={liking}
              aria-pressed={build.isLiked}
              className={`flex items-center gap-1.5 text-sm transition-colors ${
                build.isLiked ? 'text-accent' : 'text-muted hover:text-ink'
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill={build.isLiked ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="1.6"
              >
                <path d="M12 20.3s-7.5-4.6-9.8-9.2C.7 7.6 2.4 4 6 4c2 0 3.6 1.1 4.5 2.6C11.4 5.1 13 4 15 4c3.6 0 5.3 3.6 3.8 7.1-2.3 4.6-9.8 9.2-9.8 9.2Z" />
              </svg>
              {build.likesCount} like{build.likesCount === 1 ? '' : 's'}
            </button>

            <button
              type="button"
              onClick={handleCopy}
              disabled={copying}
              className="flex items-center gap-1.5 text-sm text-muted hover:text-ink disabled:opacity-60"
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="8" y="8" width="12" height="12" rx="1.5" />
                <path d="M4 16V5.5A1.5 1.5 0 0 1 5.5 4H16" />
              </svg>
              {copying ? 'Copying…' : `Copy this build${build.copiesCount ? ` (${build.copiesCount})` : ''}`}
            </button>

            {build.isOwner ? (
              <>
                <button type="button" onClick={() => setEditing(true)} className="text-sm text-muted hover:text-ink">
                  Edit
                </button>
                <button type="button" onClick={() => setConfirmDelete(true)} className="text-sm text-muted hover:text-stock-out">
                  Delete
                </button>
              </>
            ) : (
              isAuthenticated && (
                <button
                  type="button"
                  onClick={() => setReportTarget({ targetType: 'communityBuild', targetId: build._id })}
                  className="text-sm text-muted hover:text-ink"
                >
                  Report
                </button>
              )
            )}
          </div>

          {error && <p className="text-sm text-stock-out mt-4">{error}</p>}

          {copyResult && (
            <div className="mt-5 border border-border-soft rounded p-4 space-y-3">
              <p className="text-sm text-ink font-medium">{formatNPR(copyResult.total)} refreshed just now</p>
              <p className="text-xs text-faint">
                {copyResult.report.status === 'error'
                  ? 'A compatibility issue was found since this was posted — continue in the builder to fix it.'
                  : copyResult.report.status === 'warning'
                  ? 'Minor compatibility warnings — you can still add it to cart, or review them in the builder.'
                  : 'Prices, stock, and compatibility all check out.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={handleEditInBuilder} className="btn-secondary !px-4 !py-2 text-xs">
                  Continue in Builder
                </button>
                {copyResult.orderable && (
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    disabled={addingToCart}
                    className="btn-primary !px-4 !py-2 text-xs"
                  >
                    {addingToCart ? 'Adding…' : 'Add straight to cart'}
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-lg font-semibold text-ink">Parts list</h2>
              <span className="font-mono text-sm text-ink">{formatNPR(build.totalPrice)}</span>
            </div>
            <BuildComponentsList components={build.components} />
          </div>

          <div className="mt-10">
            <CommentThread buildId={build._id} onReport={setReportTarget} />
          </div>
        </div>

        <div className="w-full lg:w-72 shrink-0">
          <BuildRatingWidget
            buildId={build._id}
            isOwner={build.isOwner}
            myRating={build.myRating}
            averageRating={build.averageRating}
            ratingCount={build.ratingCount}
            onUpdate={(patch) => setBuild((prev) => ({ ...prev, ...patch }))}
          />
        </div>
      </div>

      {reportTarget && <ReportModal target={reportTarget} onClose={() => setReportTarget(null)} />}

      {editing && (
        <PublishBuildModal
          existingBuild={build}
          onSaved={(updated) => {
            setBuild((prev) => ({ ...prev, ...updated }));
            setEditing(false);
          }}
          onClose={() => setEditing(false)}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this post?"
          message="This removes it from the community feed along with its likes, comments, and ratings. This can't be undone."
          confirmLabel="Delete"
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
