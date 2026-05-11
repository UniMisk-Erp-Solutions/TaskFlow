/**
 * In-memory access token for Axios (sync interceptor). Updated from AuthContext
 * whenever Supabase session changes so we never await getSession() inside axios.
 */
let accessToken = null;

export function setApiAccessToken(token) {
  accessToken = token && typeof token === 'string' ? token : null;
}

export function getApiAccessToken() {
  return accessToken;
}
