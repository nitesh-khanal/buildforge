export default function Footer() {
  return (
    <footer className="border-t border-border-soft mt-20">
      <div className="max-w-content mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row justify-between gap-6 text-sm text-faint">
        <div>
          <p className="font-display text-ink font-semibold">
            Build<span className="text-accent">Forge</span>
          </p>
          <p className="mt-1 max-w-xs">PC parts and custom builds, checked for compatibility before they reach your cart.</p>
        </div>
        <div className="flex gap-10">
          <div className="space-y-1">
            <p className="text-muted mb-2">Shop</p>
            <p>Components</p>
            <p>Custom builds</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted mb-2">Prices</p>
            <p>All prices in NPR</p>
            <p>COD, card &amp; eSewa</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
