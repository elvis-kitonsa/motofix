// config/health.ts — developer debugging helpers (not used in the normal app flow).
// checkServiceHealth() pings the auth and requests services to see if they're up,
// and testAuthEndpoint() tries the send-OTP call. Handy when something isn't working
// and you want to confirm the backend is reachable; results are printed to the console.

import axios from 'axios';
import { AUTH_BASE_URL, REQUESTS_BASE_URL } from './api';

export async function checkServiceHealth() {
  console.log('🏥 Checking Motofix services health...');
  
  const services = {
    auth: { url: AUTH_BASE_URL, healthy: false, error: '' },
    requests: { url: REQUESTS_BASE_URL, healthy: false, error: '' },
  };

  // Check Auth Service
  try {
    console.log('🔍 Checking Auth Service:', AUTH_BASE_URL);
    const response = await axios.get(`${AUTH_BASE_URL}/health`, { timeout: 5000 });
    services.auth.healthy = response.status === 200;
    console.log('✅ Auth Service is healthy');
  } catch (error: any) {
    services.auth.error = error.message;
    console.warn('⚠️ Auth Service check failed:', error.message);
  }

  // Check Requests Service
  try {
    console.log('🔍 Checking Requests Service:', REQUESTS_BASE_URL);
    const response = await axios.get(`${REQUESTS_BASE_URL}/health`, { timeout: 5000 });
    services.requests.healthy = response.status === 200;
    console.log('✅ Requests Service is healthy');
  } catch (error: any) {
    services.requests.error = error.message;
    console.warn('⚠️ Requests Service check failed:', error.message);
  }

  console.log('📊 Health Check Results:', services);
  return services;
}

export async function testAuthEndpoint(phone: string) {
  console.log('🧪 Testing Auth endpoint with phone:', phone);
  
  try {
    const response = await axios.post(`${AUTH_BASE_URL}/auth/send-otp`, { phone }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000,
    });
    console.log('✅ Auth endpoint test successful:', response.status);
    return { success: true, status: response.status };
  } catch (error: any) {
    console.error('❌ Auth endpoint test failed:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    return { 
      success: false, 
      status: error.response?.status,
      error: error.message,
      data: error.response?.data,
    };
  }
}
