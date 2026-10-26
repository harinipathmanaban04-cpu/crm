import axios from 'axios';
import { API_URL } from './config';
import { getToken } from './storage';

const api = axios.create({ baseURL: API_URL, timeout: 15000, headers: { 'Content-Type': 'application/json' } });
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (f) => { onUnauthorized = f; };
export const setPasswordChangeHandler = (f) => { onPwChange = f; };
let onPwChange = () => {};

api.interceptors.request.use(async (c) => { const t = await getToken(); if (t) c.headers.Authorization = `Bearer ${t}`; return c; });
api.interceptors.response.use((r) => r, (e) => {
  const s = e.response?.status, code = e.response?.data?.code;
  if (s === 401 && !String(e.config?.url).includes('/auth/login')) onUnauthorized();
  if (s === 403 && code === 'PASSWORD_CHANGE_REQUIRED') onPwChange();
  return Promise.reject(e);
});

export function errMsg(e) {
  if (e.response?.data?.message) return e.response.data.message;
  if (e.code === 'ECONNABORTED') return 'The server took too long to respond. Please try again.';
  if (e.request) return `Cannot reach the server (${API_URL}). Check your internet / Wi-Fi and that the CRM server is running.`;
  return e.message || 'Something went wrong';
}
export default api;
