export default function QuantityStepper({ value, min = 1, max, onChange, disabled }) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(max ? Math.min(max, value + 1) : value + 1);

  return (
    <div className="inline-flex items-stretch border border-border rounded overflow-hidden">
      <button
        type="button"
        onClick={dec}
        disabled={disabled || value <= min}
        aria-label="Decrease quantity"
        className="px-2.5 text-muted hover:text-ink hover:bg-raised disabled:opacity-30 disabled:pointer-events-none transition-colors"
      >
        −
      </button>
      <span className="w-10 flex items-center justify-center font-mono text-sm text-ink border-x border-border">
        {value}
      </span>
      <button
        type="button"
        onClick={inc}
        disabled={disabled || (max ? value >= max : false)}
        aria-label="Increase quantity"
        className="px-2.5 text-muted hover:text-ink hover:bg-raised disabled:opacity-30 disabled:pointer-events-none transition-colors"
      >
        +
      </button>
    </div>
  );
}
