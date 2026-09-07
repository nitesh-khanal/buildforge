import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../lib/api';
import { useAuth } from './AuthContext';

const WishlistContext = createContext(null);

// Wishlist requires login (backend/models/Wishlist.js has no guest concept),
// so this context tracks only a set of wishlisted product ids client-side
// — cheap to check on every ProductCard — and refetches whenever auth state
// changes, clearing on logout.
export function WishlistProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [ids, setIds] = useState(() => new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setIds(new Set());
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get('/wishlist');
      setIds(new Set(data.items.map((i) => i.product._id)));
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isWishlisted = useCallback((productId) => ids.has(productId), [ids]);

  const toggle = useCallback(
    async (productId) => {
      if (!isAuthenticated) {
        return { ok: false, message: 'Log in to save items to your wishlist.' };
      }
      const wasWishlisted = ids.has(productId);
      // Optimistic update — the heart flips immediately, then reconciles.
      setIds((prev) => {
        const next = new Set(prev);
        wasWishlisted ? next.delete(productId) : next.add(productId);
        return next;
      });
      try {
        if (wasWishlisted) {
          await api.delete(`/wishlist/${productId}`);
        } else {
          await api.post('/wishlist', { productId });
        }
        return { ok: true };
      } catch (err) {
        // Revert on failure.
        setIds((prev) => {
          const next = new Set(prev);
          wasWishlisted ? next.add(productId) : next.delete(productId);
          return next;
        });
        return { ok: false, message: err.message };
      }
    },
    [ids, isAuthenticated]
  );

  const value = useMemo(
    () => ({ ids, loading, error, count: ids.size, isWishlisted, toggle, refresh }),
    [ids, loading, error, isWishlisted, toggle, refresh]
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within a WishlistProvider');
  return ctx;
}
