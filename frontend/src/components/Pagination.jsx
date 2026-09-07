export default function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null;

  const nums = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(pages, start + 4);
  for (let i = start; i <= end; i++) nums.push(i);

  return (
    <nav className="flex items-center justify-center gap-1 pt-10" aria-label="Pagination">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="px-3 py-1.5 text-sm text-muted hover:text-ink disabled:opacity-30 disabled:pointer-events-none"
      >
        Prev
      </button>
      {start > 1 && <span className="px-2 text-faint">…</span>}
      {nums.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`w-8 h-8 text-sm font-mono rounded transition-colors ${
            n === page ? 'bg-accent text-ink' : 'text-muted hover:text-ink hover:bg-raised'
          }`}
        >
          {n}
        </button>
      ))}
      {end < pages && <span className="px-2 text-faint">…</span>}
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= pages}
        className="px-3 py-1.5 text-sm text-muted hover:text-ink disabled:opacity-30 disabled:pointer-events-none"
      >
        Next
      </button>
    </nav>
  );
}
