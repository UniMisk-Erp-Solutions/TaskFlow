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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      fetchProfile(session).finally(() => setLoading(false));
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setLoading(true);
        setUser(session?.user ?? null);
        await fetchProfile(session);
        setLoading(false);
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email, password) {
    const { data, error } = await api.post('/auth/login', { email, password });
    if (error) throw new Error(error.response?.data?.error || 'Login failed');
    
    // Set session in Supabase client for consistency
    if (data.session) {
      await supabase.auth.setSession(data.session.access_token, data.session.refresh_token);
      // Update user state immediately
      setUser(data.user);
      // Fetch profile with the new session
      await fetchProfile(data.session);
    }
    return data;
  }

  async function signUp(email, password, fullName, role) {
    const { data, error } = await api.post('/auth/signup', { 
      email, 
      password, 
      fullName,
      role 
    });
    if (error) throw new Error(error.response?.data?.error || 'Signup failed');

    // Set session in Supabase client for consistency
    if (data.session) {
      await supabase.auth.setSession(data.session.access_token, data.session.refresh_token);
      // Update user state immediately
      setUser(data.user);
      // Fetch profile with the new session
      await fetchProfile(data.session);
    }
    return data;
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
