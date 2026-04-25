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
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signUp(email, password, fullName, role) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;

    // Update profile with name and selected role
    // Requires Supabase RLS policy: allow users to update own profile row
    if (data.user) {
      await supabase
        .from('profiles')
        .update({ full_name: fullName, role })
        .eq('id', data.user.id);
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
