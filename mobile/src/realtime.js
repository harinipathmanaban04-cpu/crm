import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_URL } from './config';
import { getToken, getItem, setItem } from './storage';
import { useAuth } from './auth';
import api from './api';

const Ctx = createContext({ socket: null, connected: false, reconnects: 0, items: [], unread: 0, markAllRead: () => {}, refreshNotifications: async () => {}, toast: null, dismissToast: () => {}, notifError: '' });
export const useRealtime = () => useContext(Ctx);

export const EV = {
  lead: ['lead:created', 'lead:assigned', 'lead:updated'],
  task: ['task:assigned', 'task:updated', 'task:completed'],
  customer: ['customer:created', 'customer:updated'],
  adm: ['admission:updated'],
  pay: ['payment:updated'],
};
const NOTIFY_EVENTS = [...EV.lead, ...EV.task];

export function RealtimeProvider({ children }) {
  const { user, logout, reload } = useAuth();
  const uid = user && !user.mustChangePassword ? user._id : null;
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [reconnects, setReconnects] = useState(0);
  const [items, setItems] = useState([]);
  const [seenAt, setSeenAt] = useState(0);
  const [toast, setToast] = useState(null);
  const [notifError, setNotifError] = useState('');
  const known = useRef(null); // ids already shown; null until first load so we never toast old items

  const refreshNotifications = useCallback(async () => {
    try {
      const { data } = await api.get('/mobile/notifications');
      setNotifError('');
      if (known.current) {
        const fresh = data.items.filter((i) => !known.current.has(i.id) && ['lead_assigned', 'task_assigned'].includes(i.type));
        if (fresh[0]) setToast(fresh[0]);
      }
      known.current = new Set(data.items.map((i) => i.id));
      setItems(data.items);
    } catch (e) { setNotifError(e.response?.data?.message || 'Could not load notifications'); }
  }, []);

  useEffect(() => { // reset + load when the user changes
    known.current = null; setItems([]); setToast(null);
    if (!uid) return;
    (async () => { setSeenAt(Number(await getItem(`seen_${uid}`)) || 0); await refreshNotifications(); })();
  }, [uid, refreshNotifications]);

  useEffect(() => {
    if (!uid) return;
    let s; let dead = false;
    (async () => {
      const token = await getToken(); if (dead || !token) return;
      s = io(SOCKET_URL, { auth: { token }, transports: ['websocket'], reconnection: true, reconnectionDelay: 1000, reconnectionDelayMax: 8000 });
      let first = true;
      s.on('connect', () => { setConnected(true); if (!first) setReconnects((n) => n + 1); first = false; });
      s.on('disconnect', () => setConnected(false));
      s.on('connect_error', (e) => { setConnected(false); if (e.message === 'unauthorized') s.disconnect(); });
      s.on('session:revoked', () => logout('Your session was ended by an administrator.'));
      s.on('user:updated', ({ id }) => { if (id === uid) reload().catch(() => {}); });
      let t; NOTIFY_EVENTS.forEach((e) => s.on(e, () => { clearTimeout(t); t = setTimeout(refreshNotifications, 400); }));
      setSocket(s);
    })();
    return () => { dead = true; s?.disconnect(); setSocket(null); setConnected(false); };
  }, [uid]); // eslint-disable-line

  useEffect(() => { if (reconnects > 0) refreshNotifications(); }, [reconnects, refreshNotifications]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 5000); return () => clearTimeout(t); }, [toast]);

  const unread = items.filter((i) => new Date(i.at).getTime() > seenAt).length;
  const markAllRead = () => { const now = Date.now(); setSeenAt(now); if (uid) setItem(`seen_${uid}`, now); };

  return <Ctx.Provider value={{ socket, connected, reconnects, items, unread, markAllRead, refreshNotifications, toast, dismissToast: () => setToast(null), notifError }}>{children}</Ctx.Provider>;
}

/** Run `cb` (debounced) when any of `events` arrive, and again after a reconnect so nothing is missed while offline. */
export function useLive(events, cb) {
  const { socket, reconnects } = useRealtime();
  const ref = useRef(cb); ref.current = cb;
  const key = events.join();
  useEffect(() => {
    if (!socket) return;
    let t; const h = () => { clearTimeout(t); t = setTimeout(() => ref.current(), 300); };
    events.forEach((e) => socket.on(e, h));
    return () => { events.forEach((e) => socket.off(e, h)); clearTimeout(t); };
  }, [socket, key]); // eslint-disable-line
  useEffect(() => { if (reconnects > 0) ref.current(); }, [reconnects]);
}
