import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import Pagination from '../Pagination';

function timeAgo(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-NP', { dateStyle: 'medium' });
}

export default function CommentThread({ buildId, onReport }) {
  const { user, isAuthenticated } = useAuth();

  const [comments, setComments] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [busyId, setBusyId] = useState(null);

  function load() {
    setLoading(true);
    api
      .get(`/community/builds/${buildId}/comments`, { params: { page } })
      .then(({ data }) => {
        setComments(data.comments);
        setPages(data.pages);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildId, page]);

  async function handlePost(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setPosting(true);
    setError(null);
    try {
      await api.post(`/community/builds/${buildId}/comments`, { text: text.trim() });
      setText('');
      setPage(1);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setPosting(false);
    }
  }

  function startEdit(comment) {
    setEditingId(comment._id);
    setEditText(comment.text);
  }

  async function handleSaveEdit(commentId) {
    if (!editText.trim()) return;
    setBusyId(commentId);
    try {
      const { data } = await api.put(`/community/builds/${buildId}/comments/${commentId}`, {
        text: editText.trim(),
      });
      setComments((prev) => prev.map((c) => (c._id === commentId ? data.comment : c)));
      setEditingId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(commentId) {
    setBusyId(commentId);
    try {
      await api.delete(`/community/builds/${buildId}/comments/${commentId}`);
      setComments((prev) => prev.filter((c) => c._id !== commentId));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section>
      <h2 className="font-display text-lg font-semibold text-ink mb-4">Comments</h2>

      {isAuthenticated ? (
        <form onSubmit={handlePost} className="mb-6 flex flex-col gap-2">
          <textarea
            className="input-field w-full min-h-[70px] resize-y"
            value={text}
            maxLength={1000}
            onChange={(e) => setText(e.target.value)}
            placeholder="Share your thoughts on this build…"
          />
          <div>
            <button type="submit" disabled={posting || !text.trim()} className="btn-secondary py-1.5 px-4 text-xs disabled:opacity-50">
              {posting ? 'Posting…' : 'Post comment'}
            </button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-faint mb-6">
          <Link to="/login" className="text-accent hover:underline">
            Log in
          </Link>{' '}
          to join the conversation.
        </p>
      )}

      {error && <p className="text-sm text-stock-out mb-4">{error}</p>}

      {loading ? (
        <p className="text-sm text-faint">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-faint">No comments yet — be the first.</p>
      ) : (
        <div className="flex flex-col divide-y divide-border-soft">
          {comments.map((c) => {
            const isMine = user && c.user?._id === user._id;
            const isEditing = editingId === c._id;
            return (
              <div key={c._id} className="py-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-ink">{c.user?.name || 'BuildForge customer'}</span>
                  <span className="text-xs text-faint">
                    {timeAgo(c.createdAt)}
                    {c.isEdited ? ' (edited)' : ''}
                  </span>
                </div>

                {isEditing ? (
                  <div className="mt-2 flex flex-col gap-2">
                    <textarea
                      className="input-field w-full min-h-[60px] resize-y"
                      value={editText}
                      maxLength={1000}
                      onChange={(e) => setEditText(e.target.value)}
                    />
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(c._id)}
                        disabled={busyId === c._id}
                        className="btn-secondary py-1 px-3 text-xs disabled:opacity-50"
                      >
                        {busyId === c._id ? 'Saving…' : 'Save'}
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} className="text-xs text-muted hover:text-ink">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted mt-1.5 leading-relaxed whitespace-pre-wrap">{c.text}</p>
                )}

                {!isEditing && (
                  <div className="flex items-center gap-4 mt-2">
                    {isMine ? (
                      <>
                        <button type="button" onClick={() => startEdit(c)} className="text-xs text-faint hover:text-ink">
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(c._id)}
                          disabled={busyId === c._id}
                          className="text-xs text-faint hover:text-stock-out disabled:opacity-50"
                        >
                          {busyId === c._id ? 'Deleting…' : 'Delete'}
                        </button>
                      </>
                    ) : (
                      isAuthenticated &&
                      onReport && (
                        <button
                          type="button"
                          onClick={() => onReport({ targetType: 'comment', targetId: c._id })}
                          className="text-xs text-faint hover:text-ink"
                        >
                          Report
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Pagination page={page} pages={pages} onChange={setPage} />
    </section>
  );
}
