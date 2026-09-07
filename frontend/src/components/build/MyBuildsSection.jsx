import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import { formatNPR } from '../../utils/format';
import PublishBuildModal from '../community/PublishBuildModal';

const STATUS_DOT = {
  compatible: 'bg-stock-in',
  warning: 'bg-stock-low',
  error: 'bg-stock-out',
};

export default function MyBuildsSection({ onLoadBuild, refreshSignal }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [error, setError] = useState(null);
  const [builds, setBuilds] = useState([]);
  const [pendingId, setPendingId] = useState(null);
  const [publishingBuild, setPublishingBuild] = useState(null);
  const [publishedId, setPublishedId] = useState(null);

  async function fetchBuilds() {
    setLoading(true);
    setError(null);
    setAuthRequired(false);
    try {
      const { data } = await api.get('/builds');
      setBuilds(data.builds);
      setLoaded(true);
    } catch (err) {
      if (err.message?.toLowerCase().includes('log in')) {
        setAuthRequired(true);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !loaded) fetchBuilds();
  }

  // Re-fetch after a successful save (from the parent) if the list is
  // already open, so a just-saved build shows up without another click.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (open && loaded) fetchBuilds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]);

  async function handleDelete(id) {
    setPendingId(id);
    try {
      await api.delete(`/builds/${id}`);
      setBuilds((prev) => prev.filter((b) => b._id !== id));
    } catch (err) {
      setError(err.message);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="border-t border-border-soft pt-4">
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between text-sm text-muted hover:text-ink transition-colors"
      >
        <span>My saved builds</span>
        <svg
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {loading && <p className="text-xs text-faint">Loading…</p>}

          {authRequired && (
            <p className="text-xs text-faint">
              <Link to="/login" className="text-accent hover:underline">
                Log in
              </Link>{' '}
              to save and load builds. Your current selections stay right here in the meantime.
            </p>
          )}

          {error && <p className="text-xs text-stock-out">{error}</p>}

          {!loading && !authRequired && loaded && builds.length === 0 && (
            <p className="text-xs text-faint">No saved builds yet.</p>
          )}

          {builds.map((b) => (
            <div
              key={b._id}
              className="flex items-center justify-between gap-2 border border-border-soft rounded px-3 py-2"
            >
              <button
                type="button"
                onClick={() => onLoadBuild(b)}
                className="flex-1 min-w-0 text-left"
              >
                <span className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[b.compatibilityStatus] || 'bg-faint'}`} />
                  <span className="text-sm text-ink truncate">{b.name}</span>
                </span>
                <span className="text-xs font-mono text-faint">{formatNPR(b.totalPrice)}</span>
              </button>
              {publishedId === b._id ? (
                <span className="text-[11px] text-stock-in shrink-0">Published!</span>
              ) : (
                <button
                  type="button"
                  onClick={() => setPublishingBuild(b)}
                  disabled={b.compatibilityStatus === 'error'}
                  title={
                    b.compatibilityStatus === 'error'
                      ? 'Fix this build\u2019s compatibility error before publishing'
                      : 'Publish to community'
                  }
                  className="text-[11px] text-faint hover:text-accent shrink-0 disabled:opacity-30 disabled:pointer-events-none"
                >
                  Publish
                </button>
              )}
              <button
                type="button"
                onClick={() => handleDelete(b._id)}
                disabled={pendingId === b._id}
                aria-label={`Delete ${b.name}`}
                className="text-faint hover:text-stock-out p-1 shrink-0 disabled:opacity-40"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {publishingBuild && (
        <PublishBuildModal
          sourceBuildId={publishingBuild._id}
          onSaved={() => {
            setPublishedId(publishingBuild._id);
            setPublishingBuild(null);
            setTimeout(() => setPublishedId(null), 2400);
          }}
          onClose={() => setPublishingBuild(null)}
        />
      )}
    </div>
  );
}
