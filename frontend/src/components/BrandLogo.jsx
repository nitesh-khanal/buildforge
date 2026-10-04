export default function BrandLogo() {
  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap" aria-label="BuildForge">
      <img src="/brand-mark.svg" alt="" aria-hidden="true" width="30" height="30" className="shrink-0" />
      <span className="font-display font-semibold text-lg tracking-tight text-ink" aria-hidden="true">
        Build<span className="text-accent">Forge</span>
      </span>
    </span>
  );
}
