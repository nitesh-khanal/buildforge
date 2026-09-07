import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../lib/api';
import { useAuth } from './AuthContext';

const AddressContext = createContext(null);

// Saved addresses require login (backend/models/Address.js has no guest
// concept), so this mirrors WishlistContext's shape: refetch whenever auth
// state changes, clear on logout.
export function AddressProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setAddresses([]);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get('/addresses');
      setAddresses(data.addresses);
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

  const createAddress = useCallback(async (payload) => {
    const { data } = await api.post('/addresses', payload);
    await refresh();
    return data.address;
  }, [refresh]);

  const updateAddress = useCallback(async (id, payload) => {
    const { data } = await api.put(`/addresses/${id}`, payload);
    await refresh();
    return data.address;
  }, [refresh]);

  const setDefaultAddress = useCallback(async (id) => {
    await api.patch(`/addresses/${id}/default`);
    await refresh();
  }, [refresh]);

  const deleteAddress = useCallback(async (id) => {
    await api.delete(`/addresses/${id}`);
    await refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      addresses,
      loading,
      error,
      refresh,
      createAddress,
      updateAddress,
      setDefaultAddress,
      deleteAddress,
    }),
    [addresses, loading, error, refresh, createAddress, updateAddress, setDefaultAddress, deleteAddress]
  );

  return <AddressContext.Provider value={value}>{children}</AddressContext.Provider>;
}

export function useAddresses() {
  const ctx = useContext(AddressContext);
  if (!ctx) throw new Error('useAddresses must be used within an AddressProvider');
  return ctx;
}
