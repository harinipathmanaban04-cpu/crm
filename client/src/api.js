import axios from 'axios';
const apiOrigin = import.meta.env.VITE_API_URL?.replace(/\/+$/, '');
const api = axios.create({
  baseURL: apiOrigin ? `${apiOrigin}/api` : '/api',
  timeout: 25000,
});
api.interceptors.request.use((c) => {
  const t = localStorage.getItem('crm_token');
  if (t) c.headers.Authorization = 'Bearer ' + t;
  return c;
});
api.interceptors.response.use((r) => r, (e) => {
  const s = e.response?.status, code = e.response?.data?.code;
  if (s === 401 && !e.config?.url?.includes('/auth/login')) {
    localStorage.removeItem('crm_token');
    if (location.pathname !== '/login') location.href = '/login?expired=1';
  }
  if (s === 403 && code === 'PASSWORD_CHANGE_REQUIRED' && location.pathname !== '/change-password') {
    location.href = '/change-password';
  }
  return Promise.reject(e);
});

export const errMsg = (e) => {
  if (e.code === 'ECONNABORTED' || e.message?.toLowerCase().includes('timeout')) {
    return 'Request timed out — backend is taking longer to respond. Please try again.';
  }
  return e.response?.data?.message || (e.request ? 'Network error — check your connection or server status' : e.message);
};

export default api;
