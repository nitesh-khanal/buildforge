// Minimal monoline glyphs, hand-drawn to match the schematic/spec-sheet
// aesthetic instead of pulling in an icon library for eight symbols.
const PATHS = {
  cpu: (
    <>
      <rect x="7" y="7" width="10" height="10" />
      <rect x="10" y="10" width="4" height="4" />
      <path d="M9 3v3M12 3v3M15 3v3M9 18v3M12 18v3M15 18v3M3 9h3M3 12h3M3 15h3M18 9h3M18 12h3M18 15h3" />
    </>
  ),
  gpu: (
    <>
      <rect x="3" y="7" width="18" height="9" />
      <circle cx="7.5" cy="11.5" r="1.6" />
      <circle cx="13" cy="11.5" r="1.6" />
      <path d="M3 19h6M18 7v-2h3" />
    </>
  ),
  motherboard: (
    <>
      <rect x="3" y="3" width="18" height="18" />
      <rect x="6" y="6" width="6" height="6" />
      <path d="M15 6h3M15 9h3M15 12h3M6 15h3M11 15h7M6 18h4" />
    </>
  ),
  ram: (
    <>
      <rect x="4" y="6" width="16" height="12" />
      <path d="M8 6v3M11 6v3M14 6v3M17 6v3" />
    </>
  ),
  storage: (
    <>
      <rect x="4" y="4" width="16" height="16" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="0.8" />
    </>
  ),
  psu: (
    <>
      <rect x="4" y="8" width="16" height="10" />
      <path d="M8 8V5h8v3M9 12h2v4H9zM13 13h2M13 15.5h2" />
    </>
  ),
  case: (
    <>
      <rect x="6" y="2" width="12" height="20" />
      <path d="M9 6h6M9 9.5h6M9 13h2" />
      <circle cx="14.5" cy="13" r="2" />
    </>
  ),
  'cpu-cooler': (
    <>
      <circle cx="12" cy="12" r="7" />
      <path d="M12 5c1.6 0 2.4 1.6 1.4 2.9M19 12c0 1.6-1.6 2.4-2.9 1.4M12 19c-1.6 0-2.4-1.6-1.4-2.9M5 12c0-1.6 1.6-2.4 2.9-1.4" />
      <circle cx="12" cy="12" r="1.3" />
    </>
  ),
};

export default function CategoryIcon({ category, className = 'w-6 h-6' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {PATHS[category] || <circle cx="12" cy="12" r="8" />}
    </svg>
  );
}
