import axios from 'axios';
import supabase from './supabaseClient';

const baseURL = import.meta.env.VITE_API_URL;
if (!baseURL) {
  throw new Error('Missing VITE_API_URL. Configure frontend/.env for local or frontend/.env.production for hosted.');
}

const api = axios.create({
  baseURL,
  // Default `legacyInterceptorReqResOrdering: true` can break async request interceptors
  // (login/signup would hang or never dispatch). Use the modern chain for this client.
  transitional: {
    silentJSONParsing: true,
    forcedJSONParsing: true,
    clarifyTimeoutError: false,
    legacyInterceptorReqResOrdering: false,
  },
});

function isPublicAuthRequest(config) {
  const u = config.url || '';
  return u === '/auth/login' || u === '/auth/signup' || u.endsWith('/auth/login') || u.endsWith('/auth/signup');
}

function setAuthHeader(config, token) {
  const h = config.headers;
  if (!h) {
    config.headers = { Authorization: `Bearer ${token}` };
    return;
  }
  if (typeof h.set === 'function') {
    if (token) h.set('Authorization', `Bearer ${token}`);
    else h.delete('Authorization');
  } else {
    if (token) h.Authorization = `Bearer ${token}`;
    else delete h.Authorization;
  }
}

/**
 * Attach JWT from Supabase on each request (source of truth for multi-device / post-login).
 * Skip getSession() for login/signup so those calls are not blocked by auth state.
 */
api.interceptors.request.use(
  async (config) => {
    if (isPublicAuthRequest(config)) {
      return config;
    }

    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) console.warn('Supabase getSession:', error.message);
      const session = data?.session ?? null;
      window.cachedSession = session ?? null;
      if (session?.access_token) {
        setAuthHeader(config, session.access_token);
      } else {
        setAuthHeader(config, null);
      }
    } catch (e) {
      console.warn('API auth interceptor:', e);
    }
    return config;
  },
  undefined,
  { synchronous: false },
);

api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error),
);

export default api;
