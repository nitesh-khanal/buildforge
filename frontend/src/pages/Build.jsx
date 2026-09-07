import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useCart } from '../context/CartContext';
import { formatNPR } from '../utils/format';
import { CATEGORY_LABELS } from '../utils/specs';
import BuildSlotRow from '../components/build/BuildSlotRow';
import PartPickerModal from '../components/build/PartPickerModal';
import CompatibilityPanel from '../components/build/CompatibilityPanel';
import MyBuildsSection from '../components/build/MyBuildsSection';

// Build order matches the backend's CATEGORY_KEYS (backend/controllers/buildController.js).
const BUILD_SLOTS = ['cpu', 'cpu-cooler', 'motherboard', 'ram', 'gpu', 'storage', 'psu', 'case'];
// Every slot except the cooler is required to check out — same rule the
// backend's isBuildOrderable() and the complete-build recommender use.
const REQUIRED_SLOTS = BUILD_SLOTS.filter((s) => s !== 'cpu-cooler');

const EMPTY_SELECTION = BUILD_SLOTS.reduce((acc, s) => ({ ...acc, [s]: null }), {});

// Maps each pairwise compatibility check's `category` key (from
// compatibilityService.js) to the builder slot(s) it should flag.
const ISSUE_SLOT_MAP = {
  'cpu-motherboard': ['cpu', 'motherboard'],
  'ram-motherboard': ['ram', 'motherboard'],
  'motherboard-case': ['motherboard', 'case'],
  'gpu-case': ['gpu', 'case'],
  'cooler-cpu': ['cpu-cooler', 'cpu'],
  'cooler-case': ['cpu-cooler', 'case'],
  'cooler-cpu-tdp': ['cpu-cooler', 'cpu'],
  'psu-power': ['psu'],
  'psu-case': ['psu', 'case'],
};

function componentIds(selected) {
  return BUILD_SLOTS.filter((s) => selected[s]).reduce((acc, s) => {
    acc[s] = selected[s]._id;
    return acc;
  }, {});
}

export default function Build() {
  const { addCustomBuild } = useCart();

  const [selected, setSelected] = useState(EMPTY_SELECTION);
  const [report, setReport] = useState(null);
  const [orderable, setOrderable] = useState(false);
  const [total, setTotal] = useState(0);
  const [checking, setChecking] = useState(false);

  const [suggestions, setSuggestions] = useState(null);

  const [pickerSlot, setPickerSlot] = useState(null);

  const [name, setName] = useState('My Build');
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | auth-required | error
  const [saveMessage, setSaveMessage] = useState(null);
  const [refreshSignal, setRefreshSignal] = useState(0);

  const [addState, setAddState] = useState('idle'); // idle | adding | added | error

  const location = useLocation();
  const navigate = useNavigate();
  const [loadedNotice, setLoadedNotice] = useState(null);

  // Phase 8 — a "Copy this build" action on a community post navigates here
  // with fresh, already compatibility-checked components in router state
  // (see CommunityBuildDetail.jsx's copy flow, which calls
  // POST /community/builds/:id/copy first so this page never has to trust
  // a stale published snapshot). Consumed once on mount, then cleared from
  // history so a refresh or back-navigation doesn't reload it again.
  useEffect(() => {
    const loadBuild = location.state?.loadBuild;
    if (!loadBuild) return;
    setSelected((prev) => ({ ...prev, ...loadBuild.components }));
    if (loadBuild.name) setName(loadBuild.name);
    setLoadedNotice(
      loadBuild.reportStatus === 'error'
        ? `Loaded from "${loadBuild.name}" — a compatibility issue was found since it was posted. Fix it below before adding to cart.`
        : `Loaded from "${loadBuild.name}" — prices and stock were refreshed just now.`
    );
    navigate(location.pathname, { replace: true, state: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live compatibility check + "complete my build" suggestions, debounced
  // so a run of quick picks doesn't fire a request per click.
  useEffect(() => {
    const ids = componentIds(selected);
    let cancelled = false;
    setChecking(true);

    const handle = setTimeout(() => {
      api
        .post('/builds/check', { components: ids })
        .then(({ data }) => {
          if (cancelled) return;
          setReport(data.report);
          setOrderable(data.orderable);
          setTotal(data.total);
        })
        .catch(() => {})
        .finally(() => !cancelled && setChecking(false));

      const emptySlots = BUILD_SLOTS.filter((s) => !selected[s]);
      if (emptySlots.length > 0) {
        api
          .post('/recommendations/complete-build', { components: ids })
          .then(({ data }) => !cancelled && setSuggestions(data.suggestions))
          .catch(() => {});
      } else {
        setSuggestions(null);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [selected]);

  function handlePick(product) {
    setSelected((prev) => ({ ...prev, [pickerSlot]: product }));
    setPickerSlot(null);
    setAddState('idle');
  }

  function handleRemove(slot) {
    setSelected((prev) => ({ ...prev, [slot]: null }));
    setAddState('idle');
  }

  function handleQuickAdd(slot, product) {
    setSelected((prev) => ({ ...prev, [slot]: product }));
    setAddState('idle');
  }

  function handleLoadBuild(build) {
    const next = BUILD_SLOTS.reduce((acc, s) => {
      acc[s] = build.components?.[s] || null;
      return acc;
    }, {});
    setSelected(next);
    setName(build.name);
    setSaveState('idle');
    setSaveMessage(null);
  }

  async function handleSave() {
    if (!(report?.selectedCount > 0)) return;
    setSaveState('saving');
    setSaveMessage(null);
    try {
      await api.post('/builds', { name: name || 'My Build', components: componentIds(selected) });
      setSaveState('saved');
      setRefreshSignal((n) => n + 1);
      setTimeout(() => setSaveState('idle'), 1800);
    } catch (err) {
      if (err.message?.toLowerCase().includes('log in')) {
        setSaveState('auth-required');
        setSaveMessage('Log in to save builds — login arrives in Phase 7c.');
      } else {
        setSaveState('error');
        setSaveMessage(err.message);
      }
    }
  }

  async function handleAddToCart() {
    setAddState('adding');
    const components = BUILD_SLOTS.filter((s) => selected[s]).map((s) => ({ productId: selected[s]._id }));
    const res = await addCustomBuild(components);
    if (res.ok) {
      setAddState('added');
      setTimeout(() => setAddState('idle'), 1800);
    } else {
      setAddState('error');
    }
  }

  const suggestionEntries = Object.entries(suggestions || {}).filter(([, list]) => list?.length);

  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold text-ink">PC Builder</h1>
        <p className="text-sm text-faint mt-1">
          Pick a part for each slot — socket, RAM, form-factor, clearance, and power checks run live.
        </p>
      </div>

      {loadedNotice && (
        <div className="mb-6 flex items-start justify-between gap-4 border border-border-soft rounded p-4 bg-raised">
          <p className="text-sm text-muted">{loadedNotice}</p>
          <button
            type="button"
            onClick={() => setLoadedNotice(null)}
            className="text-faint hover:text-ink shrink-0"
            aria-label="Dismiss"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-10 items-start">
        <div className="flex-1 min-w-0 w-full space-y-3">
          {BUILD_SLOTS.map((slot) => (
            <BuildSlotRow
              key={slot}
              slot={slot}
              required={REQUIRED_SLOTS.includes(slot)}
              product={selected[slot]}
              issues={(report?.issues || []).filter((i) => (ISSUE_SLOT_MAP[i.category] || []).includes(slot))}
              onChoose={() => setPickerSlot(slot)}
              onRemove={() => handleRemove(slot)}
            />
          ))}

          {suggestionEntries.length > 0 && (
            <div className="border border-border-soft rounded p-5 space-y-6 mt-6">
              <h2 className="text-sm font-medium text-ink">Suggested to complete your build</h2>
              {suggestionEntries.map(([slot, list]) => (
                <div key={slot}>
                  <p className="text-xs font-mono text-faint uppercase tracking-wide mb-2">{CATEGORY_LABELS[slot]}</p>
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {list.map(({ product, issues }) => (
                      <button
                        key={product._id}
                        type="button"
                        onClick={() => handleQuickAdd(slot, product)}
                        className="shrink-0 w-40 text-left border border-border-soft hover:border-accent rounded p-3 transition-colors"
                      >
                        <p className="text-xs text-faint uppercase tracking-wide truncate">{product.brand}</p>
                        <p className="text-sm text-ink font-medium leading-snug mt-0.5 line-clamp-2">{product.name}</p>
                        <p className="text-xs font-mono text-muted mt-2">{formatNPR(product.price)}</p>
                        {issues.length > 0 && <p className="text-[11px] text-stock-low mt-1">Minor warning</p>}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="w-full lg:w-80 shrink-0">
          <CompatibilityPanel
            report={report}
            total={total}
            requiredCount={REQUIRED_SLOTS.length}
            totalSlots={BUILD_SLOTS.length}
            orderable={orderable}
            checking={checking}
            name={name}
            onNameChange={setName}
            onSave={handleSave}
            saveState={saveState}
            saveMessage={saveMessage}
            onAddToCart={handleAddToCart}
            addState={addState}
            myBuilds={<MyBuildsSection onLoadBuild={handleLoadBuild} refreshSignal={refreshSignal} />}
          />
        </div>
      </div>

      {pickerSlot && (
        <PartPickerModal
          slot={pickerSlot}
          currentProductId={selected[pickerSlot]?._id}
          onSelect={handlePick}
          onClose={() => setPickerSlot(null)}
        />
      )}
    </div>
  );
}
