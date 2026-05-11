import axios from 'axios';
import supabase from './supabaseClient';

const baseURL = import.meta.env.VITE_API_URL;
if (!baseURL) {
  throw new Error('Missing VITE_API_URL. Configure frontend/.env for local or frontend/.env.production for hosted.');
}

const api = axios.create({
  baseURL,
});

/**
 * Always attach the latest JWT from Supabase (local storage / in-memory).
 * Do not rely on a separate cachedSession variable: on a new device, the first
 * API calls after login could run before any auth listener had updated the cache,
 * so requests went out without Authorization → 401 → empty tasks/meetings.
 */
api.interceptors.request.use(async (config) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  window.cachedSession = session ?? null;
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  } else {
    delete config.headers.Authorization;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error),
);

export default api;
