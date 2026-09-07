import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import Pagination from '../../components/Pagination';
import { COMMUNITY_CATEGORY_LABELS } from '../../utils/community';

const TABS = [
  { key: 'builds', label: 'Builds' },
  { key: 'comments', label: 'Comments' },
  { key: 'reports', label: 'Reports' },
];

function StatusBadge({ status }) {
  const hidden = status === 'hidden';
  return (
    <span
      className={`text-[11px] font-mono rounded px-1.5 py-0.5 border ${
        hidden ? 'text-stock-out border-stock-out/40' : 'text-accent border-accent/40'
      }`}
    >
      {status}
    </span>
  );
}

function BuildsTab() {
  const [builds, setBuilds] = useState([]);
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
      .get('/admin/community/builds', { params })
      .then(({ data }) => {
        setBuilds(data.builds);
        setMeta({ total: data.total, page: data.page, pages: data.pages });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status]);

  async function handleHide(build) {
    setBusyId(build._id);
    try {
      const { data } = await api.patch(`/admin/community/builds/${build._id}/hide`, {
        reason: reasonDraft[build._id] || '',
      });
      setBuilds((prev) => prev.map((b) => (b._id === build._id ? data.build : b)));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleUnhide(build) {
    setBusyId(build._id);
    try {
      const { data } = await api.patch(`/admin/community/builds/${build._id}/unhide`);
      setBuilds((prev) => prev.map((b) => (b._id === build._id ? data.build : b)));
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
          <option value="">All builds</option>
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
      ) : builds.length === 0 ? (
        <p className="text-sm text-faint">No builds match.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {builds.map((b) => (
            <div key={b._id} className="border border-border-soft rounded p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link to={`/community/builds/${b._id}`} className="font-medium text-ink text-sm hover:text-accent">
                      {b.title}
                    </Link>
                    <span className="text-[11px] font-mono text-faint uppercase tracking-wide">
                      {COMMUNITY_CATEGORY_LABELS[b.category] || b.category}
                    </span>
                    <span className="text-[11px] font-mono text-faint">{b.visibility}</span>
                    <StatusBadge status={b.status} />
                  </div>
                  <p className="text-xs text-faint mt-2">
                    {b.user?.name || 'Unknown user'} ({b.user?.email}) ·{' '}
                    {new Date(b.createdAt).toLocaleDateString('en-NP', { dateStyle: 'medium' })} · {b.likesCount} likes ·{' '}
                    {b.commentsCount} comments
                  </p>
                  {b.status === 'hidden' && b.moderationReason && (
                    <p className="text-xs text-faint mt-1 italic">Reason: {b.moderationReason}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {b.status === 'visible' ? (
                    <>
                      <input
                        className="input-field text-xs py-1.5 w-40"
                        placeholder="Reason (optional)"
                        value={reasonDraft[b._id] || ''}
                        onChange={(e) => setReasonDraft((prev) => ({ ...prev, [b._id]: e.target.value }))}
                      />
                      <button
                        type="button"
                        onClick={() => handleHide(b)}
                        disabled={busyId === b._id}
                        className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40"
                      >
                        {busyId === b._id ? 'Hiding…' : 'Hide'}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleUnhide(b)}
                      disabled={busyId === b._id}
                      className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40"
                    >
                      {busyId === b._id ? 'Restoring…' : 'Unhide'}
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

function CommentsTab() {
  const [comments, setComments] = useState([]);
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
      .get('/admin/community/comments', { params })
      .then(({ data }) => {
        setComments(data.comments);
        setMeta({ total: data.total, page: data.page, pages: data.pages });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status]);

  async function handleHide(comment) {
    setBusyId(comment._id);
    try {
      const { data } = await api.patch(`/admin/community/comments/${comment._id}/hide`, {
        reason: reasonDraft[comment._id] || '',
      });
      setComments((prev) => prev.map((c) => (c._id === comment._id ? data.comment : c)));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleUnhide(comment) {
    setBusyId(comment._id);
    try {
      const { data } = await api.patch(`/admin/community/comments/${comment._id}/unhide`);
      setComments((prev) => prev.map((c) => (c._id === comment._id ? data.comment : c)));
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
          <option value="">All comments</option>
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
      ) : comments.length === 0 ? (
        <p className="text-sm text-faint">No comments match.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {comments.map((c) => (
            <div key={c._id} className="border border-border-soft rounded p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-ink">{c.user?.name || 'Unknown user'}</span>
                    <span className="text-xs text-faint">on</span>
                    {c.communityBuild ? (
                      <Link to={`/community/builds/${c.communityBuild._id}`} className="text-xs text-accent hover:underline truncate">
                        {c.communityBuild.title}
                      </Link>
                    ) : (
                      <span className="text-xs text-faint">a deleted build</span>
                    )}
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="text-sm text-muted mt-2 leading-relaxed">{c.text}</p>
                  <p className="text-xs text-faint mt-2">
                    {c.user?.email} · {new Date(c.createdAt).toLocaleDateString('en-NP', { dateStyle: 'medium' })}
                  </p>
                  {c.status === 'hidden' && c.moderationReason && (
                    <p className="text-xs text-faint mt-1 italic">Reason: {c.moderationReason}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {c.status === 'visible' ? (
                    <>
                      <input
                        className="input-field text-xs py-1.5 w-40"
                        placeholder="Reason (optional)"
                        value={reasonDraft[c._id] || ''}
                        onChange={(e) => setReasonDraft((prev) => ({ ...prev, [c._id]: e.target.value }))}
                      />
                      <button
                        type="button"
                        onClick={() => handleHide(c)}
                        disabled={busyId === c._id}
                        className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40"
                      >
                        {busyId === c._id ? 'Hiding…' : 'Hide'}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleUnhide(c)}
                      disabled={busyId === c._id}
                      className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40"
                    >
                      {busyId === c._id ? 'Restoring…' : 'Unhide'}
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

const RESOLVABLE_STATUSES = ['reviewed', 'dismissed', 'actioned'];

function ReportsTab() {
  const [reports, setReports] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1 });
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [resolveDraft, setResolveDraft] = useState({});

  function load() {
    setLoading(true);
    setError(null);
    const params = { page, limit: 20 };
    if (status) params.status = status;
    api
      .get('/admin/community/reports', { params })
      .then(({ data }) => {
        setReports(data.reports);
        setMeta({ total: data.total, page: data.page, pages: data.pages });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status]);

  function draftFor(id) {
    return resolveDraft[id] || { status: 'reviewed', resolutionNotes: '' };
  }

  async function handleResolve(report) {
    const draft = draftFor(report._id);
    setBusyId(report._id);
    try {
      const { data } = await api.patch(`/admin/community/reports/${report._id}/resolve`, draft);
      setReports((prev) => prev.map((r) => (r._id === report._id ? data.report : r)));
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
          <option value="">All reports</option>
          <option value="pending">Pending</option>
          <option value="reviewed">Reviewed</option>
          <option value="dismissed">Dismissed</option>
          <option value="actioned">Actioned</option>
        </select>
        <span className="text-xs text-faint">{meta.total} total</span>
      </div>

      {error && (
        <p className="text-sm text-stock-out bg-accent-soft/40 border border-stock-out/40 rounded px-3 py-2 mb-4">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-faint">Loading…</p>
      ) : reports.length === 0 ? (
        <p className="text-sm text-faint">No reports match.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {reports.map((r) => {
            const draft = draftFor(r._id);
            const targetLink =
              r.targetType === 'communityBuild' ? `/community/builds/${r.targetId}` : null;
            return (
              <div key={r._id} className="border border-border-soft rounded p-4">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-[11px] font-mono text-faint uppercase tracking-wide">{r.targetType}</span>
                  {targetLink ? (
                    <Link to={targetLink} className="text-xs text-accent hover:underline">
                      View build
                    </Link>
                  ) : (
                    <span className="text-xs text-faint">id: {r.targetId}</span>
                  )}
                  <span
                    className={`text-[11px] font-mono rounded px-1.5 py-0.5 border ${
                      r.status === 'pending'
                        ? 'text-stock-low border-stock-low/40'
                        : r.status === 'dismissed'
                        ? 'text-faint border-border-soft'
                        : 'text-accent border-accent/40'
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
                <p className="text-sm text-ink font-medium">{r.reason}</p>
                {r.details && <p className="text-sm text-muted mt-1 leading-relaxed">{r.details}</p>}
                <p className="text-xs text-faint mt-2">
                  Reported by {r.reporter?.name || 'Unknown user'} ({r.reporter?.email}) ·{' '}
                  {new Date(r.createdAt).toLocaleDateString('en-NP', { dateStyle: 'medium' })}
                </p>
                {r.status !== 'pending' && r.resolutionNotes && (
                  <p className="text-xs text-faint mt-1 italic">Resolution notes: {r.resolutionNotes}</p>
                )}

                {r.status === 'pending' && (
                  <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-border-soft">
                    <select
                      value={draft.status}
                      onChange={(e) =>
                        setResolveDraft((prev) => ({ ...prev, [r._id]: { ...draft, status: e.target.value } }))
                      }
                      className="input-field text-xs py-1.5"
                    >
                      {RESOLVABLE_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <input
                      className="input-field text-xs py-1.5 flex-1 min-w-[160px]"
                      placeholder="Resolution notes (optional)"
                      value={draft.resolutionNotes}
                      onChange={(e) =>
                        setResolveDraft((prev) => ({ ...prev, [r._id]: { ...draft, resolutionNotes: e.target.value } }))
                      }
                    />
                    <button
                      type="button"
                      onClick={() => handleResolve(r)}
                      disabled={busyId === r._id}
                      className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40"
                    >
                      {busyId === r._id ? 'Saving…' : 'Resolve'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Pagination page={meta.page} pages={meta.pages} onChange={setPage} />
    </div>
  );
}

export default function AdminCommunity() {
  const [tab, setTab] = useState('builds');

  return (
    <div>
      <div className="flex items-center gap-1 mb-6 border-b border-border-soft">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
              tab === t.key ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'builds' && <BuildsTab />}
      {tab === 'comments' && <CommentsTab />}
      {tab === 'reports' && <ReportsTab />}
    </div>
  );
}
