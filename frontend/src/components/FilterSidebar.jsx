import { CATEGORY_LABELS } from '../utils/specs';

const RATINGS = [4, 3, 2];

export default function FilterSidebar({ filters, categories, onChange, onReset }) {
  const set = (patch) => onChange({ ...filters, ...patch });

  return (
    <aside className="w-full lg:w-60 shrink-0 space-y-7">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-ink">Category</h3>
        </div>
        <ul className="space-y-1">
          <li>
            <button
              type="button"
              onClick={() => set({ category: '' })}
              className={`w-full flex items-center justify-between text-sm px-2 py-1.5 rounded transition-colors ${
                !filters.category ? 'text-accent' : 'text-muted hover:text-ink'
              }`}
            >
              All parts
            </button>
          </li>
          {categories.map((c) => (
            <li key={c.slug}>
              <button
                type="button"
                onClick={() => set({ category: c.slug })}
                className={`w-full flex items-center justify-between text-sm px-2 py-1.5 rounded transition-colors ${
                  filters.category === c.slug ? 'text-accent' : 'text-muted hover:text-ink'
                }`}
              >
                <span>{CATEGORY_LABELS[c.slug] || c.slug}</span>
                <span className="font-mono text-xs text-faint">{c.count}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-sm font-medium text-ink mb-3">Brand</h3>
        <input
          type="text"
          value={filters.brand}
          onChange={(e) => set({ brand: e.target.value })}
          placeholder="e.g. ASUS, NVIDIA"
          className="input-field w-full"
        />
      </div>

      <div>
        <h3 className="text-sm font-medium text-ink mb-3">Price (NPR)</h3>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            value={filters.minPrice}
            onChange={(e) => set({ minPrice: e.target.value })}
            placeholder="Min"
            className="input-field w-full font-mono"
          />
          <span className="text-faint">–</span>
          <input
            type="number"
            min="0"
            value={filters.maxPrice}
            onChange={(e) => set({ maxPrice: e.target.value })}
            placeholder="Max"
            className="input-field w-full font-mono"
          />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-ink mb-3">Minimum rating</h3>
        <ul className="space-y-1">
          <li>
            <button
              type="button"
              onClick={() => set({ rating: '' })}
              className={`text-sm px-2 py-1 rounded transition-colors ${
                !filters.rating ? 'text-accent' : 'text-muted hover:text-ink'
              }`}
            >
              Any
            </button>
          </li>
          {RATINGS.map((r) => (
            <li key={r}>
              <button
                type="button"
                onClick={() => set({ rating: String(r) })}
                className={`text-sm px-2 py-1 rounded transition-colors ${
                  filters.rating === String(r) ? 'text-accent' : 'text-muted hover:text-ink'
                }`}
              >
                {r}+ stars
              </button>
            </li>
          ))}
        </ul>
      </div>

      <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
        <input
          type="checkbox"
          checked={filters.availability === 'in-stock'}
          onChange={(e) => set({ availability: e.target.checked ? 'in-stock' : '' })}
          className="accent-accent"
        />
        In stock only
      </label>

      <button type="button" onClick={onReset} className="text-xs text-faint hover:text-ink underline underline-offset-4">
        Reset filters
      </button>
    </aside>
  );
}
