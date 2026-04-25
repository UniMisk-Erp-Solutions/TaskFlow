import axios from 'axios';
import supabase from './supabaseClient';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
console.log('API client initialized with baseURL:', baseURL);

const api = axios.create({
  baseURL,
});

// Attach Supabase JWT automatically to every request
api.interceptors.request.use(async (config) => {
  console.log('API Request:', {
    method: config.method,
    url: config.url,
    fullUrl: `${baseURL}${config.url}`,
    hasAuth: !!config.headers.Authorization
  });

  try {
    const { data: { session } } = await supabase.auth.getSession();
    console.log('API Request - Session check:', { 
      hasSession: !!session, 
      hasToken: !!session?.access_token,
      userEmail: session?.user?.email 
    });
    
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
      console.log('API Request - Auth header added');
    } else {
      console.log('API Request - No session found');
    }
  } catch (err) {
    console.error('API Request - Session error:', err);
  }
  
  console.log('Final API Request:', {
    method: config.method,
    url: config.url,
    fullUrl: `${baseURL}${config.url}`,
    hasAuth: !!config.headers.Authorization
  });

  return config;
});

export default api;
