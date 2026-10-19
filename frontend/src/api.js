import axios from 'axios';
import { getApiAccessToken } from './sessionAccess';
import supabase from './supabaseClient';

const baseURL = import.meta.env.VITE_API_URL;
if (!baseURL) {
  throw new Error('Missing VITE_API_URL. Configure frontend/.env for local or frontend/.env.production for hosted.');
}

const api = axios.create({
  baseURL,
  transitional: {
    silentJSONParsing: true,
    forcedJSONParsing: true,
    clarifyTimeoutError: false,
    legacyInterceptorReqResOrdering: false,
  },
});

// Supabase Edge Function gateway API key (public anon key). Express ignores it; the
// local Express AI proxy forwards it when routing assistant calls to the Edge Function.
if (import.meta.env.VITE_SUPABASE_ANON_KEY) {
  api.defaults.headers.common.apikey = import.meta.env.VITE_SUPABASE_ANON_KEY;
}

function isPublicAuthRequest(config) {
  const u = config.url || '';
  return u === '/auth/login' || u === '/auth/signup' || u.endsWith('/auth/login') || u.endsWith('/auth/signup');
}

function getExistingAuthorization(config) {
  const h = config.headers;
  if (!h) return null;
  if (typeof h.get === 'function') {
    return h.get('Authorization') || h.get('authorization') || null;
  }
  return h.Authorization || h.authorization || null;
}

function setAuthHeader(config, token) {
  const h = config.headers;
  if (!h) {
    config.headers = token ? { Authorization: `Bearer ${token}` } : {};
    return;
  }
  if (typeof h.set === 'function') {
    if (token) h.set('Authorization', `Bearer ${token}`);
    else h.delete('Authorization');
  } else if (token) {
    h.Authorization = `Bearer ${token}`;
  } else {
    delete h.Authorization;
  }
}

function tokenNearExpiry(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return !Number.isFinite(payload.exp) || payload.exp <= Date.now() / 1000 + 60;
  } catch {
    return true;
  }
}

/**
 * Prefer the cached token updated by AuthContext. If an early request races the initial
 * getSession(), read Supabase's persisted session before sending it to the Edge Function.
 * Never overwrites an Authorization header already set on the request (e.g. fetchProfile).
 */
api.interceptors.request.use(
  async (config) => {
    if (isPublicAuthRequest(config)) {
      return config;
    }
    if (getExistingAuthorization(config)) {
      return config;
    }
    let token = getApiAccessToken();
    if (!token || tokenNearExpiry(token)) {
      try {
        const { data } = await supabase.auth.getSession();
        token = data?.session?.access_token || token;
      } catch {
        // Let the API return its normal auth response if the local session cannot be read.
      }
    }
    if (token) {
      setAuthHeader(config, token);
    }
    return config;
  },
);

api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error),
);

export default api;
