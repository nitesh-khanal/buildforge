import { useEffect, useState } from 'react';
import Modal from './Modal';
import api from '../../lib/api';
import { formatNPR } from '../../utils/format';
import OrderStatusBadge from '../order/OrderStatusBadge';

export default function UserDetailModal({ userId, currentUserId, onClose, onRoleChanged }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingRole, setSavingRole] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get(`/admin/users/${userId}`)
      .then((res) => !cancelled && setData(res.data))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function toggleRole() {
    const nextRole = data.user.role === 'admin' ? 'customer' : 'admin';
    setSavingRole(true);
    setError(null);
    try {
      const { data: res } = await api.patch(`/admin/users/${userId}/role`, { role: nextRole });
      setData((d) => ({ ...d, user: res.user }));
      onRoleChanged(res.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingRole(false);
    }
  }

  const isSelf = userId === currentUserId;

  return (
    <Modal title="Customer" onClose={onClose} width="max-w-lg">
      {loading ? (
        <p className="text-sm text-faint py-10 text-center">Loading…</p>
      ) : error && !data ? (
        <p className="text-sm text-stock-out py-10 text-center">{error}</p>
      ) : (
        <div className="space-y-5">
          {error && (
            <p className="text-sm text-stock-out bg-accent-soft/40 border border-stock-out/40 rounded px-3 py-2">{error}</p>
          )}

          <div>
            <p className="text-ink font-medium">{data.user.name}</p>
            <p className="text-sm text-muted">{data.user.email}</p>
            {data.user.phone && <p className="text-sm text-muted">{data.user.phone}</p>}
            <p className="text-xs font-mono text-faint mt-1">
              Joined {new Date(data.user.createdAt).toLocaleDateString('en-NP', { dateStyle: 'medium' })}
            </p>
          </div>

          <div className="flex items-center justify-between border border-border-soft rounded p-4">
            <div>
              <p className="text-xs text-muted">Role</p>
              <p className="text-ink text-sm mt-0.5 capitalize">{data.user.role}</p>
            </div>
            <button
              type="button"
              onClick={toggleRole}
              disabled={savingRole || isSelf}
              title={isSelf ? "You can't change your own role." : undefined}
              className="btn-secondary text-xs py-2 px-3"
            >
              {savingRole ? 'Saving…' : data.user.role === 'admin' ? 'Demote to customer' : 'Promote to admin'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="border border-border-soft rounded p-4">
              <p className="text-xs text-muted">Orders</p>
              <p className="font-display text-xl font-semibold text-ink mt-1">{data.orderCount}</p>
            </div>
            <div className="border border-border-soft rounded p-4">
              <p className="text-xs text-muted">Total spent</p>
              <p className="font-display text-xl font-semibold text-ink mt-1">{formatNPR(data.totalSpent)}</p>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-ink mb-2">Recent orders</p>
            {data.recentOrders.length === 0 ? (
              <p className="text-sm text-faint">No orders yet.</p>
            ) : (
              <div className="border border-border-soft rounded divide-y divide-border-soft">
                {data.recentOrders.map((o) => (
                  <div key={o._id} className="flex items-center justify-between px-3 py-2.5 text-sm">
                    <span className="font-mono text-xs text-ink">{o.orderId}</span>
                    <span className="font-mono text-xs text-muted">{formatNPR(o.total)}</span>
                    <OrderStatusBadge status={o.orderStatus} type="order" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
