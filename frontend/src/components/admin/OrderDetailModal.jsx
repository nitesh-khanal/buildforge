import { useState } from 'react';
import Modal from './Modal';
import api from '../../lib/api';
import OrderSummaryCard from '../order/OrderSummaryCard';
import { getSelectablePaymentStatuses } from '../../utils/paymentTransitions';

const ORDER_STATUSES = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'];

export default function OrderDetailModal({ order, onClose, onUpdated }) {
  const [orderStatus, setOrderStatus] = useState(order.orderStatus);
  const [paymentStatus, setPaymentStatus] = useState(order.paymentStatus);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [error, setError] = useState(null);

  const locked = order.orderStatus === 'Delivered' || order.orderStatus === 'Cancelled';
  // Phase 10: only offer the transitions the backend would actually accept
  // from this order's current committed payment status (not the in-progress
  // draft selection) — see utils/paymentTransitions.js.
  const selectablePaymentStatuses = getSelectablePaymentStatuses(order.paymentStatus);

  async function saveOrderStatus() {
    setSavingStatus(true);
    setError(null);
    try {
      const { data } = await api.patch(`/admin/orders/${order._id}/status`, { orderStatus });
      onUpdated(data.order);
    } catch (err) {
      setError(err.message);
      setOrderStatus(order.orderStatus);
    } finally {
      setSavingStatus(false);
    }
  }

  async function savePaymentStatus() {
    setSavingPayment(true);
    setError(null);
    try {
      const { data } = await api.patch(`/admin/orders/${order._id}/payment-status`, { paymentStatus });
      onUpdated(data.order);
    } catch (err) {
      setError(err.message);
      setPaymentStatus(order.paymentStatus);
    } finally {
      setSavingPayment(false);
    }
  }

  return (
    <Modal title={`Order ${order.orderId}`} onClose={onClose} width="max-w-3xl">
      <div className="space-y-6">
        {error && (
          <p className="text-sm text-stock-out bg-accent-soft/40 border border-stock-out/40 rounded px-3 py-2">{error}</p>
        )}

        {order.user && (
          <p className="text-sm text-muted -mt-2">
            Customer: <span className="text-ink">{order.user.name}</span> · {order.user.email}
          </p>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="border border-border-soft rounded p-4">
            <p className="text-xs text-muted mb-2">Order status</p>
            <div className="flex items-center gap-2">
              <select
                value={orderStatus}
                onChange={(e) => setOrderStatus(e.target.value)}
                disabled={locked}
                className="input-field flex-1"
              >
                {ORDER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={saveOrderStatus}
                disabled={locked || savingStatus || orderStatus === order.orderStatus}
                className="btn-secondary py-2 px-3 text-xs"
              >
                {savingStatus ? 'Saving…' : 'Save'}
              </button>
            </div>
            {locked && <p className="text-xs text-faint mt-2">{order.orderStatus} orders are terminal and can't be moved.</p>}
          </div>

          <div className="border border-border-soft rounded p-4">
            <p className="text-xs text-muted mb-2">Payment status</p>
            <div className="flex items-center gap-2">
              <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} className="input-field flex-1">
                {selectablePaymentStatuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={savePaymentStatus}
                disabled={savingPayment || paymentStatus === order.paymentStatus}
                className="btn-secondary py-2 px-3 text-xs"
              >
                {savingPayment ? 'Saving…' : 'Save'}
              </button>
            </div>
            <p className="text-xs text-faint mt-2">
              {order.paymentStatus === 'Refunded'
                ? 'Refunded is terminal — a refunded order\'s payment status can\'t be changed again.'
                : 'Manual override — for reconciliation, not routine use.'}
            </p>
          </div>
        </div>

        <OrderSummaryCard order={order} />
      </div>
    </Modal>
  );
}
