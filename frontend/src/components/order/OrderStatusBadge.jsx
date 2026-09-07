const ORDER_DOT = {
  Pending: 'bg-stock-low',
  Confirmed: 'bg-stock-in',
  Processing: 'bg-stock-in',
  Shipped: 'bg-stock-in',
  'Out for Delivery': 'bg-stock-in',
  Delivered: 'bg-stock-in',
  Cancelled: 'bg-stock-out',
};

const PAYMENT_DOT = {
  Pending: 'bg-stock-low',
  Paid: 'bg-stock-in',
  COD: 'bg-stock-in',
  Failed: 'bg-stock-out',
  Refunded: 'bg-stock-low',
};

export default function OrderStatusBadge({ status, type = 'order' }) {
  const dot = (type === 'order' ? ORDER_DOT : PAYMENT_DOT)[status] || 'bg-faint';
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-mono px-2 py-1 rounded border border-border-soft text-muted whitespace-nowrap">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
      {status}
    </span>
  );
}
