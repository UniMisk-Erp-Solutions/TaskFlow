import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import supabase from './supabaseClient';
import api from './api';
import { setApiAccessToken } from './sessionAccess';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  /** Last user id we successfully loaded `/auth/me` for — avoids duplicate SIGNED_IN nuking the UI. */
  const hydratedUserIdRef = useRef(null);
  /** True until first `getSession` + optional `fetchProfile` finishes — SIGNED_IN can fire earlier. */
  const bootstrapInProgressRef = useRef(true);

  /** @returns {Promise<boolean>} */
  async function fetchProfile(session) {
    if (!session) {
      hydratedUserIdRef.current = null;
      setProfile(null);
      setApiAccessToken(null);
      return false;
    }
    setApiAccessToken(session.access_token);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { data } = await api.get('/auth/me', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        setProfile(data);
        hydratedUserIdRef.current = data?.id ?? session.user?.id ?? null;
        return true;
      } catch (err) {
        console.warn('AuthContext - fetchProfile attempt failed:', attempt + 1, err?.message || err);
        if (attempt < 2) await new Promise((r) => setTimeout(r, 250));
      }
    }
    console.warn('AuthContext - fetchProfile failed after retries');
    setProfile((prev) => prev);
    return false;
  }

  async function refreshProfile() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return false;
    return fetchProfile(session);
  }

  useEffect(() => {
    console.log('AuthContext - Initializing session...');
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('AuthContext - Initial session:', { hasSession: !!session, hasUser: !!session?.user });
      setUser(session?.user ?? null);
      setApiAccessToken(session?.access_token ?? null);

      // Update cached session in API client
      if (session) {
        window.cachedSession = session;
      } else {
        window.cachedSession = null;
      }

      // Only fetch profile if we have a session
      if (session) {
        fetchProfile(session).finally(() => {
          setLoading(false);
          bootstrapInProgressRef.current = false;
        });
      } else {
        setLoading(false);
        bootstrapInProgressRef.current = false;
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('AuthContext - Auth state changed:', { event, hasSession: !!session });

        // Bootstrap is owned by getSession().then above; handling INITIAL_SESSION again runs
        // setLoading(true) and races fetchProfile — hooks clear tasks/meetings until many retries.
        if (event === 'INITIAL_SESSION') {
          return;
        }

        // SIGNED_IN often fires before getSession's fetchProfile completes; never run the heavy path then.
        if (event === 'SIGNED_IN' && bootstrapInProgressRef.current) {
          return;
        }

        // Token refresh when returning to the tab must not blank the UI or drop profile
        if ((event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') && session) {
          setUser(session.user);
          setApiAccessToken(session.access_token);
          window.cachedSession = session;
          await fetchProfile(session);
          return;
        }

        // setSession() after login often emits SIGNED_IN for the same user again; never toggle
        // global loading or that briefly clears dashboard data in useTasks/useMeetings.
        if (event === 'SIGNED_IN' && session?.user?.id && session.user.id === hydratedUserIdRef.current) {
          window.cachedSession = session;
          setApiAccessToken(session.access_token);
          setUser(session.user);
          await fetchProfile(session);
          return;
        }

        setLoading(true);
        setUser(session?.user ?? null);

        window.cachedSession = session;
        setApiAccessToken(session?.access_token ?? null);

        if (session) {
          if (session.user?.id && session.user.id !== hydratedUserIdRef.current) {
            setProfile(null);
          }
          await fetchProfile(session);
        } else {
          hydratedUserIdRef.current = null;
          setProfile(null);
        }
        setLoading(false);
        bootstrapInProgressRef.current = false;
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email, password) {
    try {
      console.log('AuthContext - Starting login...');
      const { data } = await api.post('/auth/login', { email, password });

      console.log('AuthContext - Login response:', { hasSession: !!data.session, user: !!data.user });

      // Set token before setSession / profile fetch so Axios never races getSession()
      if (data.session?.access_token) {
        setApiAccessToken(data.session.access_token);
      }

      // Set session in Supabase client for consistency
      if (data.session) {
        console.log('AuthContext - Setting session with tokens:', {
          hasAccessToken: !!data.session.access_token,
          hasRefreshToken: !!data.session.refresh_token
        });
        
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token
        });
        
        if (sessionError) {
          console.error('AuthContext - Failed to set session:', sessionError);
          setApiAccessToken(null);
          throw new Error(sessionError.message || 'Could not save your session');
        }

        setUser(data.user);

        const profileOk = await fetchProfile(data.session);
        if (!profileOk) {
          setApiAccessToken(null);
          await supabase.auth.signOut();
          setUser(null);
          setProfile(null);
          window.cachedSession = null;
          throw new Error(
            'Signed in but could not load your profile. Confirm VITE_API_URL points to your TaskFlow API and try again.',
          );
        }
      }
      return data;
    } catch (err) {
      console.error('AuthContext - Login error:', err);
      throw err;
    }
  }

  async function signUp(email, password, fullName, role) {
    try {
      console.log('AuthContext - Starting signup...');
      const { data } = await api.post('/auth/signup', {
        email,
        password,
        fullName,
        role,
      });

      console.log('AuthContext - Signup response:', { hasSession: !!data.session, user: !!data.user });

      if (data.session?.access_token) {
        setApiAccessToken(data.session.access_token);
      }

      // Set session in Supabase client for consistency
      if (data.session) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token
        });

        if (sessionError) {
          console.error('AuthContext - Failed to set session during signup:', sessionError);
          setApiAccessToken(null);
          throw new Error(sessionError.message || 'Could not save your session');
        }

        setUser(data.user);

        const profileOk = await fetchProfile(data.session);
        if (!profileOk) {
          setApiAccessToken(null);
          await supabase.auth.signOut();
          setUser(null);
          setProfile(null);
          window.cachedSession = null;
          throw new Error(
            'Account created but could not load your profile. Confirm VITE_API_URL points to your TaskFlow API and try again.',
          );
        }
      }
      return data;
    } catch (err) {
      console.error('AuthContext - Signup error:', err);
      throw err;
    }
  }

  /**
   * Google OAuth. Supabase redirects to Google, then back to `/app`, where the
   * onboarding gate decides: verify phone -> create org OR join by 6-digit code.
   * First-time Google users get their profile created server-side on `/auth/me`.
   */
  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/app` },
    });
    if (error) throw new Error(error.message || 'Could not start Google sign-in');
  }

  async function signOut() {
    hydratedUserIdRef.current = null;
    setApiAccessToken(null);
    window.cachedSession = null;
    await supabase.auth.signOut();
    setProfile(null);
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signInWithGoogle, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
