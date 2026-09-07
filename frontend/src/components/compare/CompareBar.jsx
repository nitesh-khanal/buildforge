import { Link, useLocation } from 'react-router-dom';
import { useCompare } from '../../context/CompareContext';
import { resolveImageUrl } from '../../utils/format';
import { CATEGORY_LABELS } from '../../utils/specs';

// Sticky bottom bar that appears once at least one product is selected for
// comparison — rendered once at the App layout level (like Navbar/Footer)
// rather than per-page, so it persists while browsing between the shop and
// product detail pages. Hidden on the comparison page itself, since the
// table there already shows the same selection.
export default function CompareBar() {
  const { items, count, category, remove, clear } = useCompare();
  const location = useLocation();

  if (count === 0 || location.pathname === '/compare') return null;

  const compareHref = `/compare?ids=${items.map((i) => i._id).join(',')}`;

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-border-soft">
      <div className="max-w-content mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          {items.map((item) => (
            <div
              key={item._id}
              className="relative shrink-0 w-12 h-12 rounded border border-border-soft bg-raised overflow-hidden"
              title={item.name}
            >
              <img
                src={resolveImageUrl(item.image)}
                alt={item.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <button
                type="button"
                onClick={() => remove(item._id)}
                aria-label={`Remove ${item.name} from comparison`}
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-base border border-border-soft text-[10px] leading-none flex items-center justify-center text-muted hover:text-accent"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="hidden sm:block text-xs text-faint shrink-0">
          {count} / 4 {CATEGORY_LABELS[category] || 'items'}
        </div>

        <div className="ml-auto flex items-center gap-2 shrink-0">
          <button type="button" onClick={clear} className="text-xs text-muted hover:text-ink px-2 py-2">
            Clear
          </button>
          {count >= 2 ? (
            <Link to={compareHref} className="btn-primary py-2 px-4 text-sm">
              Compare ({count})
            </Link>
          ) : (
            <span className="text-xs text-faint px-2">Add one more to compare</span>
          )}
        </div>
      </div>
    </div>
  );
}
