import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { formatNPR } from '../../utils/format';
import Pagination from '../../components/Pagination';
import OrderStatusBadge from '../../components/order/OrderStatusBadge';
import OrderDetailModal from '../../components/admin/OrderDetailModal';

const ORDER_STATUSES = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'];
const PAYMENT_STATUSES = ['Pending', 'Paid', 'Failed', 'COD', 'Refunded'];

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1 });
  const [search, setSearch] = useState('');
  const [orderStatus, setOrderStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  function load() {
    setLoading(true);
    setError(null);
    const params = { page, limit: 20 };
    if (search) params.search = search;
    if (orderStatus) params.orderStatus = orderStatus;
    if (paymentStatus) params.paymentStatus = paymentStatus;
    api
      .get('/admin/orders', { params })
      .then(({ data }) => {
        setOrders(data.orders);
        setMeta({ total: data.total, page: data.page, pages: data.pages });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, orderStatus, paymentStatus]);

  function handleSearchSubmit(e) {
    e.preventDefault();
    setPage(1);
    load();
  }

  function handleUpdated(order) {
    setOrders((prev) => prev.map((o) => (o._id === order._id ? { ...o, ...order } : o)));
    setSelected(order);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 min-w-[240px] max-w-md">
          <input
            className="input-field flex-1"
            placeholder="Order ID, name, or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="btn-secondary py-2 px-3 text-xs">
            Search
          </button>
        </form>
        <select
          value={orderStatus}
          onChange={(e) => {
            setOrderStatus(e.target.value);
            setPage(1);
          }}
          className="input-field"
        >
          <option value="">All order statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={paymentStatus}
          onChange={(e) => {
            setPaymentStatus(e.target.value);
            setPage(1);
          }}
          className="input-field"
        >
          <option value="">All payment statuses</option>
          {PAYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
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
                <th className="px-4 py-3 font-normal">Order</th>
                <th className="px-4 py-3 font-normal">Customer</th>
                <th className="px-4 py-3 font-normal">Placed</th>
                <th className="px-4 py-3 font-normal">Total</th>
                <th className="px-4 py-3 font-normal">Order status</th>
                <th className="px-4 py-3 font-normal">Payment</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-faint">
                    Loading…
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-faint">
                    No orders match.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr
                    key={o._id}
                    onClick={() => setSelected(o)}
                    className="border-b border-border-soft last:border-b-0 hover:bg-raised cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-ink whitespace-nowrap">{o.orderId}</td>
                    <td className="px-4 py-3 text-muted min-w-[160px]">
                      {o.user?.name || o.shippingAddress?.fullName || 'Guest'}
                      <span className="block text-xs text-faint">{o.user?.email || o.shippingAddress?.email}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-faint whitespace-nowrap">
                      {new Date(o.createdAt).toLocaleDateString('en-NP', { dateStyle: 'medium' })}
                    </td>
                    <td className="px-4 py-3 font-mono text-ink whitespace-nowrap">{formatNPR(o.total)}</td>
                    <td className="px-4 py-3">
                      <OrderStatusBadge status={o.orderStatus} type="order" />
                    </td>
                    <td className="px-4 py-3">
                      <OrderStatusBadge status={o.paymentStatus} type="payment" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={meta.page} pages={meta.pages} onChange={setPage} />

      {selected && <OrderDetailModal order={selected} onClose={() => setSelected(null)} onUpdated={handleUpdated} />}
    </div>
  );
}
