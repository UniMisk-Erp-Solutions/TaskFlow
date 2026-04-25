import axios from 'axios';
import supabase from './supabaseClient';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
console.log('API client initialized with baseURL:', baseURL);

// Cache session to avoid async calls in interceptor
let cachedSession = null;

// Update cached session when auth state changes
supabase.auth.onAuthStateChange((event, session) => {
  cachedSession = session;
  console.log('API - Session updated:', { event, hasSession: !!session });
});

const api = axios.create({
  baseURL,
});

// Attach Supabase JWT automatically to every request
api.interceptors.request.use((config) => {
  console.log('API Request:', {
    method: config.method,
    url: config.url,
    baseURL: baseURL,
    fullUrl: `${baseURL}${config.url}`,
    hasAuth: !!config.headers.Authorization,
    completeUrl: `${baseURL}${config.url}`
  });

  console.log('API Request - Session check:', { 
    hasSession: !!cachedSession, 
    hasToken: !!cachedSession?.access_token,
    userEmail: cachedSession?.user?.email 
  });
  
  if (cachedSession?.access_token) {
    config.headers.Authorization = `Bearer ${cachedSession.access_token}`;
    console.log('API Request - Auth header added');
  } else {
    console.log('API Request - No session found');
  }
  
  console.log('Final API Request:', {
    method: config.method,
    url: config.url,
    fullUrl: `${baseURL}${config.url}`,
    hasAuth: !!config.headers.Authorization
  });

  return config;
});

// Debug responses
api.interceptors.response.use(
  (response) => {
    console.log('API Response:', {
      status: response.status,
      url: response.config.url,
      method: response.config.method,
      success: true
    });
    return response;
  },
  (error) => {
    console.log('API Error:', {
      status: error.response?.status,
      url: error.config?.url,
      method: error.config?.method,
      error: error.response?.data?.error || error.message
    });
    return Promise.reject(error);
  }
);

export default api;
