import CategoryIcon from '../CategoryIcon';
import StockBadge from '../StockBadge';
import { formatNPR } from '../../utils/format';
import { CATEGORY_LABELS } from '../../utils/specs';

function apiOrigin() {
  return import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
}

const ISSUE_BORDER = {
  error: 'border-stock-out',
  warning: 'border-stock-low',
};

export default function BuildSlotRow({ slot, required, product, issues, onChoose, onRemove }) {
  const errorIssue = issues.find((i) => i.level === 'error');
  const warningIssue = !errorIssue && issues.find((i) => i.level === 'warning');
  const flagged = errorIssue || warningIssue;

  return (
    <div
      className={`flex items-center gap-4 p-4 border rounded bg-surface transition-colors ${
        flagged ? ISSUE_BORDER[flagged.level] : 'border-border-soft'
      }`}
    >
      <div className="w-10 h-10 shrink-0 rounded bg-raised border border-border-soft flex items-center justify-center text-faint">
        <CategoryIcon category={slot} className="w-5 h-5" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono text-faint uppercase tracking-wide flex items-center gap-2">
          {CATEGORY_LABELS[slot]}
          {!required && <span className="text-faint/70 normal-case">· optional</span>}
        </p>

        {product ? (
          <div className="flex items-center gap-3 mt-1">
            <div className="w-10 h-10 shrink-0 bg-raised border border-border-soft rounded overflow-hidden flex items-center justify-center">
              <img
                src={product.image?.startsWith('http') ? product.image : `${apiOrigin()}${product.image}`}
                alt={product.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
            <div className="min-w-0">
              <p className="text-ink font-medium truncate">{product.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono text-sm text-muted">{formatNPR(product.price)}</span>
                {product.stockStatus && <StockBadge status={product.stockStatus} stock={product.stock} />}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-faint mt-1">Not selected</p>
        )}

        {flagged && <p className={`text-xs mt-2 ${flagged.level === 'error' ? 'text-stock-out' : 'text-stock-low'}`}>{flagged.message}</p>}
      </div>

      <div className="shrink-0 flex items-center gap-2">
        <button type="button" onClick={onChoose} className="btn-secondary !px-3 !py-2 text-xs">
          {product ? 'Change' : 'Choose'}
        </button>
        {product && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${CATEGORY_LABELS[slot]}`}
            className="text-faint hover:text-stock-out transition-colors p-2"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
