import axios from 'axios';

const envApiUrl = import.meta.env.VITE_API_URL ? String(import.meta.env.VITE_API_URL).trim().replace(/\/$/, '') : '';
export const API_BASE_URL = envApiUrl ? `${envApiUrl}/api/v1` : '/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach bearer token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('netguard_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle 401 unauthenticated
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear token and redirect to login if not already there
      if (!window.location.pathname.includes('/login')) {
        localStorage.removeItem('netguard_token');
        localStorage.removeItem('netguard_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
