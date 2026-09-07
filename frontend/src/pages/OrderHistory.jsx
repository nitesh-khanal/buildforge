import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { formatNPR } from '../utils/format';
import OrderStatusBadge from '../components/order/OrderStatusBadge';

export default function OrderHistory() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get('/orders')
      .then(({ data }) => setOrders(data.orders))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="max-w-content mx-auto px-4 sm:px-6 py-16 text-sm text-faint">Loading your orders…</div>;
  }

  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-display text-2xl font-semibold text-ink mb-8">Your orders</h1>

      {error && <p className="text-sm text-stock-out mb-4">{error}</p>}

      {!error && orders.length === 0 ? (
        <div className="border border-border-soft rounded p-16 text-center">
          <p className="text-ink font-medium">No orders yet.</p>
          <p className="text-sm text-faint mt-1">Once you check out, your orders will show up here.</p>
          <Link to="/shop" className="btn-primary mt-6 inline-flex">
            Browse parts
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <Link
              key={o._id}
              to={`/orders/${o.orderId}`}
              className="flex flex-wrap items-center justify-between gap-3 border border-border-soft rounded p-4 hover:border-border transition-colors"
            >
              <div className="min-w-0">
                <p className="font-mono text-sm text-ink">{o.orderId}</p>
                <p className="text-xs text-faint mt-0.5">
                  {new Date(o.createdAt).toLocaleDateString('en-NP', { year: 'numeric', month: 'short', day: 'numeric' })}
                  {' · '}
                  {o.items.length} item{o.items.length === 1 ? '' : 's'}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <OrderStatusBadge status={o.orderStatus} type="order" />
                <OrderStatusBadge status={o.paymentStatus} type="payment" />
                <span className="font-mono text-ink w-24 text-right">{formatNPR(o.total)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
