import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../lib/api';
import OrderSummaryCard from '../components/order/OrderSummaryCard';
import ConfirmDialog from '../components/admin/ConfirmDialog';

export default function OrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelError, setCancelError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .get(`/orders/${id}`)
      .then(({ data }) => setOrder(data.order))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

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

  async function confirmCancelOrder() {
    if (!order) return;
    setCancelling(true);
    setCancelError(null);
    try {
      const { data } = await api.patch(`/orders/${order._id}/cancel`);
      setOrder(data.order);
      setConfirmingCancel(false);
    } catch (err) {
      setCancelError(err.message);
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return <div className="max-w-content mx-auto px-4 sm:px-6 py-16 text-sm text-faint">Loading order…</div>;
  }

  if (error || !order) {
    return (
      <div className="max-w-content mx-auto px-4 sm:px-6 py-16 text-center">
        <p className="text-sm text-stock-out">{error || 'Order not found.'}</p>
        <Link to="/orders" className="btn-secondary mt-6 inline-flex">
          Back to orders
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 py-10">
      <Link to="/orders" className="text-xs text-faint hover:text-ink mb-6 inline-block">
        &larr; All orders
      </Link>
      {cancelError && <p className="text-sm text-stock-out mb-4">{cancelError}</p>}
      <OrderSummaryCard
        order={order}
        onCheckEsewaStatus={
          order.paymentMethod === 'esewa' && order.paymentStatus === 'Pending' ? checkEsewaStatus : null
        }
        checking={checking}
        onCancelOrder={() => setConfirmingCancel(true)}
        cancelling={cancelling}
      />

      {confirmingCancel && (
        <ConfirmDialog
          title="Cancel this order?"
          message="This can't be undone. Any reserved stock will be released and, if you already paid, it will be marked for a refund."
          confirmLabel="Cancel order"
          busy={cancelling}
          onConfirm={confirmCancelOrder}
          onCancel={() => setConfirmingCancel(false)}
        />
      )}
    </div>
  );
}
