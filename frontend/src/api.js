import axios from 'axios';
import { getApiAccessToken } from './sessionAccess';

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

/**
 * Synchronous interceptor only. Token comes from sessionAccess (updated in AuthContext).
 * Never overwrites an Authorization header already set on the request (e.g. fetchProfile).
 */
api.interceptors.request.use(
  (config) => {
    if (isPublicAuthRequest(config)) {
      return config;
    }
    if (getExistingAuthorization(config)) {
      return config;
    }
    const token = getApiAccessToken();
    if (token) {
      setAuthHeader(config, token);
    }
    return config;
  },
  undefined,
  { synchronous: true },
);

api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error),
);

export default api;
