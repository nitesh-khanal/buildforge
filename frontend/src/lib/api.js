import axios from 'axios';
import { getSessionId } from './session';
import { getToken } from './authToken';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL,
  withCredentials: true, // sends the httpOnly JWT cookie once Phase 7c adds login
});

// Every request carries the guest session id. Once a user is logged in the
// backend prefers req.user over it, so this is harmless to keep sending.
api.interceptors.request.use((config) => {
  config.headers['x-session-id'] = getSessionId();
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// The backend always replies with { success, message? , ...payload }. Surface
// `message` as a normal Error so callers can just read `err.message`.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const message =
      err.response?.data?.message || err.message || 'Something went wrong. Please try again.';
    return Promise.reject(new Error(message));
  }
);

export default api;
