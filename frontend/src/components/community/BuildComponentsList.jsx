import CategoryIcon from '../CategoryIcon';
import { formatNPR } from '../../utils/format';
import { CATEGORY_LABELS } from '../../utils/specs';

// Same slot order Build.jsx's BUILD_SLOTS uses, so a published build reads
// in the exact same order it was assembled in the builder.
const SLOTS = ['cpu', 'cpu-cooler', 'motherboard', 'ram', 'gpu', 'storage', 'psu', 'case'];

export default function BuildComponentsList({ components }) {
  return (
    <div className="flex flex-col gap-2">
      {SLOTS.map((slot) => {
        const product = components?.[slot];
        return (
          <div key={slot} className="flex items-center gap-3 p-3 border border-border-soft rounded">
            <div className="w-9 h-9 shrink-0 rounded bg-raised border border-border-soft flex items-center justify-center text-faint">
              <CategoryIcon category={slot} className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-mono text-faint uppercase tracking-wide">{CATEGORY_LABELS[slot]}</p>
              {product ? (
                <p className="text-sm text-ink truncate">
                  {product.brand} {product.name}
                </p>
              ) : (
                <p className="text-sm text-faint">Not included</p>
              )}
            </div>
            {product && <span className="font-mono text-xs text-muted shrink-0">{formatNPR(product.price)}</span>}
          </div>
        );
      })}
    </div>
  );
}
