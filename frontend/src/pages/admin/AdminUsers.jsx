import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import Pagination from '../../components/Pagination';
import UserDetailModal from '../../components/admin/UserDetailModal';
import ConfirmDialog from '../../components/admin/ConfirmDialog';

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1 });
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedId, setSelectedId] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  function load() {
    setLoading(true);
    setError(null);
    const params = { page, limit: 20 };
    if (search) params.search = search;
    if (role) params.role = role;
    api
      .get('/admin/users', { params })
      .then(({ data }) => {
        setUsers(data.users);
        setMeta({ total: data.total, page: data.page, pages: data.pages });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, role]);

  function handleSearchSubmit(e) {
    e.preventDefault();
    setPage(1);
    load();
  }

  function handleRoleChanged(updated) {
    setUsers((prev) => prev.map((u) => (u._id === updated._id ? updated : u)));
  }

  async function handleDelete() {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await api.delete(`/admin/users/${deleting._id}`);
      setUsers((prev) => prev.filter((u) => u._id !== deleting._id));
      setDeleting(null);
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 min-w-[240px] max-w-md">
          <input
            className="input-field flex-1"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="btn-secondary py-2 px-3 text-xs">
            Search
          </button>
        </form>
        <select
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(1);
          }}
          className="input-field"
        >
          <option value="">All roles</option>
          <option value="customer">Customer</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      {error && (
        <p className="text-sm text-stock-out bg-accent-soft/40 border border-stock-out/40 rounded px-3 py-2 mb-4">{error}</p>
      )}

      <div className="border border-border-soft rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-soft text-left text-xs text-muted">
                <th className="px-4 py-3 font-normal">Name</th>
                <th className="px-4 py-3 font-normal">Email</th>
                <th className="px-4 py-3 font-normal">Role</th>
                <th className="px-4 py-3 font-normal">Joined</th>
                <th className="px-4 py-3 font-normal text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-faint">
                    Loading…
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-faint">
                    No customers match.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u._id} className="border-b border-border-soft last:border-b-0">
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => setSelectedId(u._id)} className="text-ink hover:text-accent transition-colors text-left">
                        {u.name}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-muted">{u.email}</td>
                    <td className="px-4 py-3 text-muted capitalize">{u.role}</td>
                    <td className="px-4 py-3 text-xs text-faint whitespace-nowrap">
                      {new Date(u.createdAt).toLocaleDateString('en-NP', { dateStyle: 'medium' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-3">
                        <button type="button" onClick={() => setSelectedId(u._id)} className="text-xs text-muted hover:text-ink transition-colors">
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(u)}
                          disabled={u._id === currentUser?._id}
                          title={u._id === currentUser?._id ? "You can't delete your own account." : undefined}
                          className="text-xs text-stock-out hover:brightness-110 transition-all disabled:opacity-30 disabled:pointer-events-none"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={meta.page} pages={meta.pages} onChange={setPage} />

      {selectedId && (
        <UserDetailModal
          userId={selectedId}
          currentUserId={currentUser?._id}
          onClose={() => setSelectedId(null)}
          onRoleChanged={handleRoleChanged}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete customer?"
          message={
            deleteError ||
            `This permanently removes "${deleting.name}"'s account. Their past orders are kept for records but will no longer link to a user.`
          }
          confirmLabel="Delete"
          busy={deleteBusy}
          onConfirm={handleDelete}
          onCancel={() => {
            setDeleting(null);
            setDeleteError(null);
          }}
        />
      )}
    </div>
  );
}
