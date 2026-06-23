// lib/axiosClient.ts — the pre-configured HTTP clients the admin portal uses.
//
// One client per backend service it talks to: requestsClient (dispatch service),
// mechanicsClient, and authClient (driver accounts). Each automatically attaches the
// admin's saved login token to every request, so individual API calls don't have to.
// Import the right client here (or use the helpers in lib/api.ts) rather than calling
// axios directly. Note the admin token is stored under 'motofix_admin_token'.

import axios from 'axios';
import { API_CONFIG } from '@/config/api';

// Shared axios client for requests service
export const requestsClient = axios.create({
  baseURL: API_CONFIG.REQUESTS_API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach Authorization header from localStorage if available
requestsClient.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem('motofix_admin_token');
    if (token) {
      config.headers = config.headers || {};
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (e) {
    // ignore
  }
  return config;
});

// Shared axios client for mechanics service (public endpoints — no auth required)
export const mechanicsClient = axios.create({
  baseURL: API_CONFIG.MECHANICS_API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

mechanicsClient.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem('motofix_admin_token');
    if (token) {
      config.headers = config.headers || {};
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (e) {
    // ignore
  }
  return config;
});

// Shared axios client for auth service (driver accounts)
export const authClient = axios.create({
  baseURL: API_CONFIG.AUTH_API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

authClient.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem('motofix_admin_token');
    if (token) {
      config.headers = config.headers || {};
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (e) {
    // ignore
  }
  return config;
});

// Basic response interceptor (passthrough)
requestsClient.interceptors.response.use(
  (res) => res,
  (err) => {
    // Let callers handle errors - but log for debugging
    console.error('requestsClient error', err?.response?.status, err?.message);
    return Promise.reject(err);
  }
);

export default requestsClient;
