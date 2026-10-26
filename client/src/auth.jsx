import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from './api';
const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!localStorage.getItem('crm_token'));
  const reload = useCallback(async () => {
    if (!localStorage.getItem('crm_token')) { setUser(null); setLoading(false); return; }
    try { setUser((await api.get('/auth/me')).data); } catch { setUser(null); } finally { setLoading(false); }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    if (!data || typeof data.token !== 'string' || !data.user || typeof data.user !== 'object') {
      throw new Error('Invalid login response. Please try again or contact support.');
    }
    localStorage.setItem('crm_token', data.token); setUser(data.user); return data.user;
  };
  const applySession = (data) => { localStorage.setItem('crm_token', data.token); setUser(data.user); };
  const logout = () => { localStorage.removeItem('crm_token'); setUser(null); };
  return <Ctx.Provider value={{ user, loading, login, logout, reload, applySession }}>{children}</Ctx.Provider>;
}
