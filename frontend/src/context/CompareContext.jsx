import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const CompareContext = createContext(null);

const STORAGE_KEY = 'buildforge_compare';
const MAX_COMPARE = 4;

// Product Comparison (Phase 3) has no backend model — see
// BUILD_FORGE_PROGRESS.md's Phase 1 design note: "comparison state is
// client-side only, there's nothing to persist server-side" — so this
// context is the source of truth, not a cache of API state like Cart/
// Wishlist. It holds lightweight product *snapshots* (id/name/image/price/
// brand/category), the same pattern Cart/Order line items already use, so
// the floating compare bar can render without an extra fetch per toggle.
// Persisted to localStorage (like the guest session id in lib/session.js)
// so a comparison in progress survives a page reload; no login required,
// same as the PC Builder.
function loadInitial() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage can fail (private browsing, quota) — comparison still works
    // for the rest of this session, it just won't survive a reload.
  }
}

export function CompareProvider({ children }) {
  const [items, setItems] = useState(loadInitial);

  const isComparing = useCallback((productId) => items.some((i) => i._id === productId), [items]);

  // Returns { ok, message? } so callers (ProductCard, ProductDetail) can
  // surface why a toggle didn't go through — different category already
  // selected, or the 4-item cap reached — without the context needing to
  // know about toasts/UI.
  const toggle = useCallback((product) => {
    let result = { ok: true };
    setItems((prev) => {
      const already = prev.some((i) => i._id === product._id);
      if (already) {
        const next = prev.filter((i) => i._id !== product._id);
        persist(next);
        return next;
      }
      if (prev.length > 0 && prev[0].category !== product.category) {
        result = { ok: false, message: 'Clear your current comparison to compare a different category.' };
        return prev;
      }
      if (prev.length >= MAX_COMPARE) {
        result = { ok: false, message: `You can compare up to ${MAX_COMPARE} products at a time.` };
        return prev;
      }
      const snapshot = {
        _id: product._id,
        name: product.name,
        image: product.image,
        price: product.price,
        brand: product.brand,
        category: product.category,
      };
      const next = [...prev, snapshot];
      persist(next);
      return next;
    });
    return result;
  }, []);

  const remove = useCallback((productId) => {
    setItems((prev) => {
      const next = prev.filter((i) => i._id !== productId);
      persist(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    persist([]);
  }, []);

  const value = useMemo(
    () => ({
      items,
      count: items.length,
      category: items[0]?.category || null,
      canAddMore: items.length < MAX_COMPARE,
      isComparing,
      toggle,
      remove,
      clear,
    }),
    [items, isComparing, toggle, remove, clear]
  );

  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
}

export function useCompare() {
  const ctx = useContext(CompareContext);
  if (!ctx) throw new Error('useCompare must be used within a CompareProvider');
  return ctx;
}
