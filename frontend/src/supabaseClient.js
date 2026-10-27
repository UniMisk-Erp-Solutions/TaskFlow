import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

// Keep the session in localStorage and silently renew the short-lived access token with
// the refresh token, so users stay signed in across browser restarts (up to the
// server-side session limit, 7 days).
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Every request reads the session under a lock. The default (5 s) steals a lock that is still held after 5 s, which makes the
    // request that held it fail with "AbortError: Lock broken by another request with the steal option" when the server is slow
    // or many requests start at once (a chat full of images). Wait longer instead; only a truly orphaned lock gets stolen.
    lockAcquireTimeout: 30000,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});

export default supabase;
