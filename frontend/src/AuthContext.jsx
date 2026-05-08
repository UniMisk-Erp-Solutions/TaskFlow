import React, { createContext, useContext, useEffect, useState } from 'react';
import supabase from './supabaseClient';
import api from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(session) {
    if (!session) { setProfile(null); return; }
    try {
      const { data } = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      setProfile(data);
    } catch {
      setProfile(null);
    }
  }

  useEffect(() => {
    console.log('AuthContext - Initializing session...');
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('AuthContext - Initial session:', { hasSession: !!session, hasUser: !!session?.user });
      setUser(session?.user ?? null);
      
      // Update cached session in API client
      if (session) {
        window.cachedSession = session;
      }
      
      // Only fetch profile if we have a session
      if (session) {
        fetchProfile(session).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        console.log('AuthContext - Auth state changed:', { event: _event, hasSession: !!session });
        setLoading(true);
        setUser(session?.user ?? null);
        
        // Update cached session in API client
        window.cachedSession = session;
        
        if (session) {
          await fetchProfile(session);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email, password) {
    try {
      console.log('AuthContext - Starting login...');
      const { data, error } = await api.post('/auth/login', { email, password });
      if (error) throw new Error(error.response?.data?.error || 'Login failed');
      
      console.log('AuthContext - Login response:', { hasSession: !!data.session, user: !!data.user });
      
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
        } else {
          console.log('AuthContext - Session set successfully');
          
          // Small delay to ensure session is stored
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Verify session was set
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          console.log('AuthContext - Session verification:', { 
            hasSession: !!currentSession,
            hasToken: !!currentSession?.access_token 
          });
        }
        
        // Update user state immediately
        setUser(data.user);
        console.log('AuthContext - User state updated');
        
        // Fetch profile with the new session (with timeout)
        try {
          await Promise.race([
            fetchProfile(data.session),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Profile fetch timeout')), 5000))
          ]);
          console.log('AuthContext - Profile fetched');
        } catch (profileError) {
          console.warn('AuthContext - Profile fetch failed or timed out:', profileError);
          // Don't fail login, just continue without profile
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
      const { data, error } = await api.post('/auth/signup', { 
        email, 
        password, 
        fullName,
        role 
      });
      if (error) throw new Error(error.response?.data?.error || 'Signup failed');

      console.log('AuthContext - Signup response:', { hasSession: !!data.session, user: !!data.user });

      // Set session in Supabase client for consistency
      if (data.session) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token
        });

        if (sessionError) {
          console.error('AuthContext - Failed to set session during signup:', sessionError);
        } else {
          console.log('AuthContext - Session set successfully during signup');
        }

        // Update user state immediately
        setUser(data.user);
        console.log('AuthContext - User state updated during signup');

        // Fetch profile with the new session (with timeout)
        try {
          await Promise.race([
            fetchProfile(data.session),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Profile fetch timeout')), 5000))
          ]);
          console.log('AuthContext - Profile fetched during signup');
        } catch (profileError) {
          console.warn('AuthContext - Profile fetch failed or timed out during signup:', profileError);
          // Don't fail signup, just continue without profile
        }
      }
      return data;
    } catch (err) {
      console.error('AuthContext - Signup error:', err);
      throw err;
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
