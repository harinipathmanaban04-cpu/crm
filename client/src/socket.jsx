import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './auth.jsx';
const Ctx = createContext({ socket: null, connected: false, reconnects: 0 });
export const useSocket = () => useContext(Ctx);

export function SocketProvider({ children }) {
  const { user, logout, reload } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [reconnects, setReconnects] = useState(0);
  const uid = user && !user.mustChangePassword ? user._id : null;
  useEffect(() => {
    if (!uid) return;
    const socketTarget = import.meta.env.VITE_SOCKET_URL || (window.location.port === '5173' ? 'http://localhost:5000' : '/');
    const s = io(socketTarget, { auth: { token: localStorage.getItem('crm_token') }, reconnection: true, reconnectionDelay: 1000, reconnectionDelayMax: 8000 });
    let first = true;
    s.on('connect', () => { setConnected(true); if (!first) setReconnects((n) => n + 1); first = false; });
    s.on('disconnect', () => setConnected(false));
    s.on('connect_error', (e) => { setConnected(false); if (e.message === 'unauthorized') { s.disconnect(); } });
    s.on('session:revoked', () => logout());
    s.on('user:updated', ({ id }) => { if (id === uid) reload(); });   // role/team changes apply instantly
    setSocket(s);
    return () => { s.disconnect(); setSocket(null); setConnected(false); };
  }, [uid]);
  return <Ctx.Provider value={{ socket, connected, reconnects }}>{children}</Ctx.Provider>;
}

// Re-run `cb` (debounced) when any of `events` arrives, and again after a reconnect so nothing is missed offline.
export function useLive(events, cb) {
  const { socket, reconnects } = useSocket();
  const ref = useRef(cb); ref.current = cb;
  const key = events.join();
  useEffect(() => {
    if (!socket) return;
    let t; const h = () => { clearTimeout(t); t = setTimeout(() => ref.current(), 250); };
    events.forEach((e) => socket.on(e, h));
    return () => { events.forEach((e) => socket.off(e, h)); clearTimeout(t); };
  }, [socket, key]);
  useEffect(() => { if (reconnects > 0) ref.current(); }, [reconnects]);
}
export const EV = {
  lead: ['lead:created', 'lead:assigned', 'lead:updated'],
  task: ['task:assigned', 'task:updated', 'task:completed'],
  team: ['team:member-added', 'team:member-removed', 'team:member-transferred'],
  customer: ['customer:created', 'customer:updated'],
  adm: ['admission:updated'], pay: ['payment:updated'], act: ['activity:created'],
};
export const ALL_EVENTS = Object.values(EV).flat();
