import { stockStatusLabel } from '../utils/format';

const DOT_COLOR = {
  'in-stock': 'bg-stock-in',
  'low-stock': 'bg-stock-low',
  'out-of-stock': 'bg-stock-out',
};

const TEXT_COLOR = {
  'in-stock': 'text-stock-in',
  'low-stock': 'text-stock-low',
  'out-of-stock': 'text-stock-out',
};

export default function StockBadge({ status, stock }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-mono ${TEXT_COLOR[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${DOT_COLOR[status]}`} />
      {stockStatusLabel(status)}
      {status === 'low-stock' && stock ? ` · ${stock} left` : ''}
    </span>
  );
}
