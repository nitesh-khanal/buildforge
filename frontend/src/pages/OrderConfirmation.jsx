import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import OrderSummaryCard from '../components/order/OrderSummaryCard';

// Keyed by the `?status=` query param backend/controllers/orderController.js
// redirects here with, from the eSewa success/failure callbacks.
const STATUS_BANNERS = {
  success: {
    tone: 'text-stock-in',
    title: 'Payment confirmed',
    body: "Your order is confirmed and moving to processing. We've emailed a receipt.",
  },
  failed: {
    tone: 'text-stock-out',
    title: 'Payment failed',
    body: 'The payment did not go through. Any stock it reserved has been released — feel free to try again.',
  },
  pending: {
    tone: 'text-stock-low',
    title: 'Payment pending',
    body: "We haven't received final confirmation from eSewa yet — this usually resolves within a few minutes.",
  },
  invalid: {
    tone: 'text-stock-out',
    title: 'Could not verify payment',
    body: 'The payment confirmation could not be verified. Contact support if you were charged.',
  },
  not_found: {
    tone: 'text-stock-out',
    title: 'Order not found',
    body: "We couldn't find an order matching this payment.",
  },
  verification_error: {
    tone: 'text-stock-low',
    title: 'Still verifying',
    body: "We're still confirming this payment with eSewa. Try the button below in a moment.",
  },
};

export default function OrderConfirmation() {
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const status = searchParams.get('status');

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(!!orderId);
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    api
      .get(`/orders/${orderId}`)
      .then(({ data }) => setOrder(data.order))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [orderId]);

  async function checkEsewaStatus() {
    if (!order) return;
    setChecking(true);
    try {
      const { data } = await api.get(`/orders/${order._id}/esewa-status`);
      setOrder(data.order);
    } catch (err) {
      setError(err.message);
    } finally {
      setChecking(false);
    }
  }

  const banner = status && STATUS_BANNERS[status];

  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 py-10">
      {banner ? (
        <div className="mb-8">
          <p className={`font-mono text-xs mb-2 ${banner.tone}`}>Order confirmation</p>
          <h1 className="font-display text-2xl font-semibold text-ink mb-2">{banner.title}</h1>
          <p className="text-muted max-w-lg">{banner.body}</p>
        </div>
      ) : (
        <div className="mb-8">
          <p className="font-mono text-xs text-stock-in mb-2">Order confirmation</p>
          <h1 className="font-display text-2xl font-semibold text-ink mb-2">Thanks — your order is placed</h1>
          <p className="text-muted max-w-lg">We&apos;ve got the details below. You can track its status anytime from your orders page.</p>
        </div>
      )}

      {loading && <p className="text-sm text-faint">Loading your order…</p>}

      {!loading && error && (
        <div className="border border-border-soft rounded p-8 text-center">
          <p className="text-sm text-stock-out">{error}</p>
          <Link to="/orders" className="btn-secondary mt-6 inline-flex">
            View your orders
          </Link>
        </div>
      )}

      {!loading && !error && order && (
        <>
          <OrderSummaryCard
            order={order}
            onCheckEsewaStatus={
              order.paymentMethod === 'esewa' && order.paymentStatus === 'Pending' ? checkEsewaStatus : null
            }
            checking={checking}
          />
          <div className="flex flex-wrap gap-4 mt-8">
            <Link to="/orders" className="btn-secondary">
              View all orders
            </Link>
            <Link to="/shop" className="btn-secondary">
              Continue shopping
            </Link>
          </div>
        </>
      )}

      {!loading && !error && !order && !orderId && (
        <div className="border border-border-soft rounded p-8 text-center">
          <p className="text-sm text-faint">No order to show here.</p>
          <Link to="/shop" className="btn-primary mt-6 inline-flex">
            Browse parts
          </Link>
        </div>
      )}
    </div>
  );
}
