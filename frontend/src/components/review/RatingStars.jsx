// Displays a static rating (`value`, non-integer allowed) or, with
// `onChange`, an interactive 1-5 star picker for the review form.
export default function RatingStars({ value = 0, onChange, size = 16 }) {
  const interactive = typeof onChange === 'function';
  const stars = [1, 2, 3, 4, 5];

  return (
    <div className="flex items-center gap-0.5" role={interactive ? 'radiogroup' : undefined}>
      {stars.map((n) => {
        const filled = interactive ? n <= value : n <= Math.round(value);
        return (
          <button
            key={n}
            type={interactive ? 'button' : undefined}
            onClick={interactive ? () => onChange(n) : undefined}
            disabled={!interactive}
            aria-label={interactive ? `${n} star${n > 1 ? 's' : ''}` : undefined}
            className={interactive ? 'cursor-pointer' : 'cursor-default'}
          >
            <svg
              viewBox="0 0 24 24"
              width={size}
              height={size}
              fill={filled ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="1.4"
              className={filled ? 'text-accent' : 'text-faint'}
            >
              <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.8L12 3.5Z" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
