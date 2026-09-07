export default function StatCard({ label, value, sub, tone }) {
  const toneClass = tone === 'warn' ? 'text-stock-low' : tone === 'bad' ? 'text-stock-out' : 'text-ink';
  return (
    <div className="border border-border-soft rounded p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`font-display text-2xl font-semibold mt-1.5 ${toneClass}`}>{value}</p>
      {sub && <p className="text-xs text-faint mt-1">{sub}</p>}
    </div>
  );
}
