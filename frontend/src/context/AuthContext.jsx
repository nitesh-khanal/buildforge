import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../lib/api';
import { setToken } from '../lib/authToken';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Runs once on load. Whether the returning visitor is recognized comes
  // from the httpOnly cookie the backend set on their last login (see
  // backend/utils/jwt.js) — the stored token in localStorage is only a
  // fallback header, not what this check relies on.
  const loadMe = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.user);
    } catch {
      setUser(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  function applySession(data) {
    setToken(data.token);
    setUser(data.user);
  }

  const register = useCallback(async (payload) => {
    setError(null);
    try {
      const { data } = await api.post('/auth/register', payload);
      applySession(data);
      return { ok: true };
    } catch (err) {
      setError(err.message);
      return { ok: false, message: err.message };
    }
  }, []);

  const login = useCallback(async (payload) => {
    setError(null);
    try {
      const { data } = await api.post('/auth/login', payload);
      applySession(data);
      return { ok: true };
    } catch (err) {
      setError(err.message);
      return { ok: false, message: err.message };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Clear local state regardless of whether the request itself succeeded.
    }
    setToken(null);
    setUser(null);
  }, []);

  const value = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    register,
    login,
    logout,
    refresh: loadMe,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
