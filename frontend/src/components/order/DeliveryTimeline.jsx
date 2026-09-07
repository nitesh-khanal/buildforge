// Phase 9: a simple visual timeline built from the order's statusHistory —
// there's no real courier tracking API to pull live scan events from (see
// backend/services/shippingNotificationService.js's own design note), so
// this is just "what BuildForge itself changed the order to, and when",
// plus the plain estimated-delivery-date shown alongside it.
const TIMELINE_STEPS = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered'];

function formatWhen(dateStr) {
  return new Date(dateStr).toLocaleString('en-NP', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatDay(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-NP', { weekday: 'long', month: 'short', day: 'numeric' });
}

export default function DeliveryTimeline({ order }) {
  const history = order.statusHistory || [];
  const historyByStatus = new Map(history.map((h) => [h.status, h]));
  const isCancelled = order.orderStatus === 'Cancelled';

  // Where the order currently sits among the normal (non-cancelled) steps —
  // everything up to and including this index is "done".
  const currentIndex = TIMELINE_STEPS.indexOf(order.orderStatus);

  return (
    <div className="border border-border-soft rounded p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-sm font-medium text-ink">Delivery status</h2>
        {order.estimatedDeliveryDate && !isCancelled && order.orderStatus !== 'Delivered' && (
          <p className="text-xs text-faint">
            Estimated <span className="text-ink font-mono">{formatDay(order.estimatedDeliveryDate)}</span>
          </p>
        )}
      </div>

      {isCancelled ? (
        <div className="flex items-start gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-stock-out mt-1 shrink-0" />
          <div>
            <p className="text-sm text-ink">Order cancelled</p>
            {historyByStatus.get('Cancelled') && (
              <p className="text-xs text-faint mt-0.5">{formatWhen(historyByStatus.get('Cancelled').changedAt)}</p>
            )}
          </div>
        </div>
      ) : (
        <ol className="space-y-0">
          {TIMELINE_STEPS.map((step, i) => {
            const entry = historyByStatus.get(step);
            const done = i <= currentIndex;
            return (
              <li key={step} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${done ? 'bg-stock-in' : 'bg-border-soft'}`}
                  />
                  {i < TIMELINE_STEPS.length - 1 && (
                    <span className={`w-px flex-1 min-h-[1.5rem] ${done ? 'bg-stock-in' : 'bg-border-soft'}`} />
                  )}
                </div>
                <div className="pb-4">
                  <p className={`text-sm ${done ? 'text-ink' : 'text-faint'}`}>{step}</p>
                  {entry && <p className="text-xs text-faint mt-0.5">{formatWhen(entry.changedAt)}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
