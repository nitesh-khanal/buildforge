import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { formatNPR } from '../utils/format';
import { COMMUNITY_CATEGORY_LABELS } from '../utils/community';
import PublishBuildModal from '../components/community/PublishBuildModal';
import ConfirmDialog from '../components/admin/ConfirmDialog';

export default function MyCommunityBuilds() {
  const [builds, setBuilds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingBuild, setEditingBuild] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  function load() {
    setLoading(true);
    api
      .get('/community/builds/mine')
      .then(({ data }) => {
        setBuilds(data.builds);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.delete(`/community/builds/${deleteTarget._id}`);
      setBuilds((prev) => prev.filter((b) => b._id !== deleteTarget._id));
      setDeleteTarget(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">My community posts</h1>
          <p className="text-sm text-faint mt-1">Everything you've published, whatever its visibility or status.</p>
        </div>
        <Link to="/community" className="btn-secondary py-2 px-4 text-sm">
          Browse community
        </Link>
      </div>

      {error && <p className="text-sm text-stock-out mb-4">{error}</p>}

      {loading ? (
        <p className="text-sm text-faint">Loading…</p>
      ) : builds.length === 0 ? (
        <div className="border border-border-soft rounded p-12 text-center">
          <p className="text-ink font-medium">You haven't published any builds yet.</p>
          <p className="text-sm text-faint mt-1">
            Head to the{' '}
            <Link to="/build" className="text-accent hover:underline">
              PC Builder
            </Link>
            , save a build, then publish it from there.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {builds.map((b) => (
            <div key={b._id} className="flex items-center gap-4 border border-border-soft rounded p-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link to={`/community/builds/${b._id}`} className="text-sm font-medium text-ink hover:text-accent truncate">
                    {b.title}
                  </Link>
                  <span className="text-[11px] font-mono text-faint uppercase tracking-wide">
                    {COMMUNITY_CATEGORY_LABELS[b.category] || b.category}
                  </span>
                  <span className="text-[11px] font-mono text-faint border border-border-soft rounded px-1.5 py-0.5">
                    {b.visibility}
                  </span>
                  {b.status === 'hidden' && (
                    <span className="text-[11px] font-mono text-stock-out border border-stock-out/40 rounded px-1.5 py-0.5">
                      hidden by moderator
                    </span>
                  )}
                </div>
                <p className="text-xs text-faint mt-1">
                  {formatNPR(b.totalPrice)} · {b.likesCount} like{b.likesCount === 1 ? '' : 's'} · {b.commentsCount} comment
                  {b.commentsCount === 1 ? '' : 's'}
                  {b.ratingCount > 0 ? ` · ${b.averageRating.toFixed(1)}★ (${b.ratingCount})` : ''}
                </p>
                {b.status === 'hidden' && b.moderationReason && (
                  <p className="text-xs text-faint mt-1 italic">Moderator note: {b.moderationReason}</p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button type="button" onClick={() => setEditingBuild(b)} className="btn-secondary py-1.5 px-3 text-xs">
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(b)}
                  className="text-xs text-faint hover:text-stock-out px-2"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingBuild && (
        <PublishBuildModal
          existingBuild={editingBuild}
          onSaved={(updated) => {
            setBuilds((prev) => prev.map((b) => (b._id === updated._id ? { ...b, ...updated } : b)));
            setEditingBuild(null);
          }}
          onClose={() => setEditingBuild(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete this post?"
          message={`"${deleteTarget.title}" will be removed from the community feed along with its likes, comments, and ratings.`}
          confirmLabel="Delete"
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
