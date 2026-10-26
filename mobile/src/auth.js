import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api, { errMsg, setUnauthorizedHandler, setPasswordChangeHandler } from './api';
import { getToken, setToken } from './storage';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

const clean = (u) => { if (u && 'plainPassword' in u) { const { plainPassword, ...rest } = u; return rest; } return u; };

export function AuthProvider({ children }) {
  const [user, setUserRaw] = useState(null);
  const setUser = useCallback((u) => setUserRaw(typeof u === 'function' ? (p) => clean(u(p)) : clean(u)), []);
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState('');
  const [notice, setNotice] = useState('');

  const logout = useCallback(async (msg = '') => { await setToken(null); setUser(null); setNotice(msg); }, []);

  const bootstrap = useCallback(async () => {
    setBooting(true); setBootError('');
    try {
      if (!(await getToken())) return;
      const { data } = await api.get('/auth/me');
      if (data.role !== 'sales') { await logout('This app is only for Sales Executives.'); return; }
      setUser(data);
    } catch (e) {
      if (e.response?.status === 401) await logout('Your session expired. Please sign in again.');
      else setBootError(errMsg(e)); // offline: keep the token, let the user retry
    } finally { setBooting(false); }
  }, [logout]);

  useEffect(() => {
    setUnauthorizedHandler(() => logout('Your session expired. Please sign in again.'));
    setPasswordChangeHandler(() => setUser((u) => (u ? { ...u, mustChangePassword: true } : u)));
    bootstrap();
  }, [bootstrap, logout]);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email: email.trim(), password });
    if (data.user.role !== 'sales') throw new Error('This app is for Sales Executives only. Admins and Super Admins please use the web CRM.');
    await setToken(data.token); setNotice(''); setUser(data.user); return data.user;
  };
  const reload = useCallback(async () => { const { data } = await api.get('/auth/me'); if (data.role !== 'sales') return logout('Your role changed. Please use the web CRM.'); setUser(data); return data; }, [logout]);
  const applySession = async ({ token, user: u }) => { await setToken(token); setUser(u); };

  return <Ctx.Provider value={{ user, booting, bootError, notice, login, logout, reload, applySession, retry: bootstrap, setUser }}>{children}</Ctx.Provider>;
}
