import { formatNPR, resolveImageUrl } from '../../utils/format';
import OrderStatusBadge from './OrderStatusBadge';
import DeliveryTimeline from './DeliveryTimeline';

const CUSTOMER_CANCELLABLE_STATUSES = ['Pending', 'Confirmed'];

function OrderItemRow({ item }) {
  return (
    <div className="flex gap-4 py-4 border-b border-border-soft last:border-b-0">
      <div className="w-16 h-16 shrink-0 bg-surface border border-border-soft rounded overflow-hidden flex items-center justify-center">
        <img
          src={resolveImageUrl(item.image)}
          alt={item.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-ink text-sm font-medium truncate">{item.name}</p>
            {item.isCustomBuild && <p className="text-xs font-mono text-accent mt-0.5">Custom PC build</p>}
            <p className="text-xs text-faint mt-0.5">Qty {item.quantity}</p>
          </div>
          <p className="font-mono text-sm text-ink shrink-0">{formatNPR(item.price * item.quantity)}</p>
        </div>

        {item.isCustomBuild && item.buildComponents?.length > 0 && (
          <ul className="mt-2 space-y-0.5">
            {item.buildComponents.map((c, i) => (
              <li key={i} className="flex justify-between text-xs text-faint">
                <span>{c.name}</span>
                <span className="font-mono">{formatNPR(c.price)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function OrderSummaryCard({ order, onCheckEsewaStatus, checking, onCancelOrder, cancelling }) {
  const canCancel = CUSTOMER_CANCELLABLE_STATUSES.includes(order.orderStatus) && onCancelOrder;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <p className="font-mono text-sm text-ink">{order.orderId}</p>
          <p className="text-xs text-faint mt-0.5">
            Placed {new Date(order.createdAt).toLocaleString('en-NP', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <OrderStatusBadge status={order.orderStatus} type="order" />
          <OrderStatusBadge status={order.paymentStatus} type="payment" />
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-10 items-start">
        <div className="space-y-4">
          <div className="border border-border-soft rounded p-5">
            <h2 className="text-sm font-medium text-ink mb-1">Items</h2>
            {order.items.map((item, i) => (
              <OrderItemRow key={i} item={item} />
            ))}
          </div>
          <DeliveryTimeline order={order} />
        </div>

        <div className="space-y-4">
          <div className="border border-border-soft rounded p-5">
            <h2 className="text-sm font-medium text-ink mb-4">Summary</h2>
            <div className="spec-row">
              <span className="spec-label">Subtotal</span>
              <span className="spec-value">{formatNPR(order.subtotal)}</span>
            </div>
            <div className="spec-row">
              <span className="spec-label">Shipping</span>
              <span className="spec-value">{order.shippingCost ? formatNPR(order.shippingCost) : 'Free'}</span>
            </div>
            {order.discount > 0 && (
              <div className="spec-row">
                <span className="spec-label">Discount</span>
                <span className="spec-value">−{formatNPR(order.discount)}</span>
              </div>
            )}
            <div className="flex items-baseline justify-between pt-4 mt-1">
              <span className="text-ink font-medium">Total</span>
              <span className="font-display text-xl font-semibold text-ink">{formatNPR(order.total)}</span>
            </div>
            <p className="text-xs text-faint mt-3 font-mono uppercase">{order.paymentMethod}</p>

            {onCheckEsewaStatus && (
              <button type="button" onClick={onCheckEsewaStatus} disabled={checking} className="btn-secondary w-full mt-4">
                {checking ? 'Checking…' : 'Check payment status'}
              </button>
            )}

            {canCancel && (
              <button type="button" onClick={onCancelOrder} disabled={cancelling} className="btn-secondary w-full mt-3">
                {cancelling ? 'Cancelling…' : 'Cancel order'}
              </button>
            )}
          </div>

          <div className="border border-border-soft rounded p-5">
            <h2 className="text-sm font-medium text-ink mb-3">Shipping to</h2>
            <p className="text-sm text-ink">{order.shippingAddress.fullName}</p>
            <p className="text-sm text-muted mt-1">{order.shippingAddress.address}</p>
            <p className="text-sm text-muted">
              {order.shippingAddress.city}, {order.shippingAddress.province}
              {order.shippingAddress.postalCode ? ` ${order.shippingAddress.postalCode}` : ''}
            </p>
            <p className="text-sm text-muted mt-1">{order.shippingAddress.phone}</p>
            <p className="text-sm text-muted">{order.shippingAddress.email}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
