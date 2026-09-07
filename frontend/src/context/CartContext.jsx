import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../lib/api';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Tracks in-flight item mutations so a card can show a per-item spinner
  // instead of blocking the whole cart.
  const [pendingItemId, setPendingItemId] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get('/cart');
      setCart(data.cart);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addItem = useCallback(async (productId, quantity = 1) => {
    setError(null);
    try {
      const { data } = await api.post('/cart/items', { productId, quantity });
      setCart(data.cart);
      return { ok: true };
    } catch (err) {
      setError(err.message);
      return { ok: false, message: err.message };
    }
  }, []);

  const updateQuantity = useCallback(async (itemId, quantity) => {
    setPendingItemId(itemId);
    setError(null);
    try {
      const { data } = await api.patch(`/cart/items/${itemId}`, { quantity });
      setCart(data.cart);
      return { ok: true };
    } catch (err) {
      setError(err.message);
      return { ok: false, message: err.message };
    } finally {
      setPendingItemId(null);
    }
  }, []);

  const addCustomBuild = useCallback(async (components) => {
    setError(null);
    try {
      const { data } = await api.post('/cart/custom-build', { components });
      setCart(data.cart);
      return { ok: true };
    } catch (err) {
      setError(err.message);
      return { ok: false, message: err.message };
    }
  }, []);

  const removeItem = useCallback(async (itemId) => {
    setPendingItemId(itemId);
    setError(null);
    try {
      const { data } = await api.delete(`/cart/items/${itemId}`);
      setCart(data.cart);
      return { ok: true };
    } catch (err) {
      setError(err.message);
      return { ok: false, message: err.message };
    } finally {
      setPendingItemId(null);
    }
  }, []);

  const clearCart = useCallback(async () => {
    setError(null);
    try {
      const { data } = await api.delete('/cart');
      setCart(data.cart);
      return { ok: true };
    } catch (err) {
      setError(err.message);
      return { ok: false, message: err.message };
    }
  }, []);

  const itemCount = useMemo(
    () => (cart?.items || []).reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const value = {
    cart,
    loading,
    error,
    pendingItemId,
    itemCount,
    subtotal: cart?.subtotal || 0,
    refresh,
    addItem,
    addCustomBuild,
    updateQuantity,
    removeItem,
    clearCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
