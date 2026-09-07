import { formatNPR } from '../../utils/format';

const STATUS_COPY = {
  compatible: 'Compatible',
  warning: 'Compatible — with warnings',
  error: 'Incompatible',
  empty: 'Start building',
};

const STATUS_DOT = {
  compatible: 'bg-stock-in',
  warning: 'bg-stock-low',
  error: 'bg-stock-out',
  empty: 'bg-faint',
};

const STATUS_TEXT = {
  compatible: 'text-stock-in',
  warning: 'text-stock-low',
  error: 'text-stock-out',
  empty: 'text-faint',
};

export default function CompatibilityPanel({
  report,
  total,
  requiredCount,
  totalSlots,
  orderable,
  checking,
  name,
  onNameChange,
  onSave,
  saveState,
  saveMessage,
  onAddToCart,
  addState,
  myBuilds,
}) {
  const status = report?.selectedCount > 0 ? report.status : 'empty';
  const sortedIssues = [...(report?.errors || []), ...(report?.warnings || [])];
  const power = report?.estimatedPowerWatts || 0;
  const recommendedPsu = report?.recommendedPsuWattage || 0;

  return (
    <div className="border border-border-soft rounded p-5 lg:sticky lg:top-24 space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${STATUS_DOT[status]}`} />
          <span className={`text-sm font-medium ${STATUS_TEXT[status]}`}>{STATUS_COPY[status]}</span>
          {checking && <span className="text-xs text-faint ml-auto">Checking…</span>}
        </div>
        <p className="text-xs text-faint mt-1">
          {report?.selectedCount || 0} of {totalSlots} parts selected ({requiredCount} required)
        </p>
      </div>

      {sortedIssues.length > 0 && (
        <ul className="space-y-2 border-t border-border-soft pt-4">
          {sortedIssues.map((issue, i) => (
            <li key={i} className={`text-xs leading-relaxed ${issue.level === 'error' ? 'text-stock-out' : 'text-stock-low'}`}>
              {issue.message}
            </li>
          ))}
        </ul>
      )}

      {power > 0 && (
        <div className="border-t border-border-soft pt-4 space-y-1">
          <div className="spec-row">
            <span className="spec-label">Estimated draw</span>
            <span className="spec-value">{power}W</span>
          </div>
          <div className="spec-row">
            <span className="spec-label">Recommended PSU</span>
            <span className="spec-value">{recommendedPsu}W+</span>
          </div>
        </div>
      )}

      <div className="border-t border-border-soft pt-4">
        <div className="flex items-baseline justify-between">
          <span className="text-ink font-medium">Total</span>
          <span className="font-display text-xl font-semibold text-ink">{formatNPR(total)}</span>
        </div>
      </div>

      <div className="border-t border-border-soft pt-4 space-y-2">
        <label className="block text-xs text-faint mb-1" htmlFor="build-name">
          Build name
        </label>
        <input
          id="build-name"
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="My Build"
          className="input-field w-full"
        />
        <button
          type="button"
          onClick={onSave}
          disabled={saveState === 'saving' || (report?.selectedCount || 0) === 0}
          className="btn-secondary w-full"
        >
          {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved ✓' : 'Save build'}
        </button>
        {saveMessage && (
          <p className={`text-xs ${saveState === 'auth-required' ? 'text-faint' : 'text-stock-out'}`}>{saveMessage}</p>
        )}
      </div>

      <button
        type="button"
        onClick={onAddToCart}
        disabled={!orderable || addState === 'adding'}
        className="btn-primary w-full"
      >
        {addState === 'adding' ? 'Adding…' : addState === 'added' ? 'Added to cart ✓' : 'Add build to cart'}
      </button>
      {!orderable && (report?.selectedCount || 0) > 0 && (
        <p className="text-xs text-faint -mt-3">
          Fill every required slot with no compatibility errors to add this build to your cart.
        </p>
      )}

      {myBuilds}
    </div>
  );
}
