import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from './api';
import { useLive, ALL_EVENTS } from './socket.jsx';
const Ctx = createContext({ options: () => [] });
export const useLookups = () => useContext(Ctx);
export function LookupProvider({ children }) {
  const [d, setD] = useState({ users: [], teams: [], courses: [], customers: [], leads: [], invoices: [] });
  const load = useCallback(() => api.get('/lookups').then((r) => setD(r.data)).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  useLive(ALL_EVENTS.filter((e) => !e.startsWith('task') && e !== 'activity:created').concat('user:updated'), load);
  const lab = (u) => u.name + (u.team?.name ? ` · ${u.team.name}` : '');
  const options = (key) => ({
    sales: d.users.filter((u) => u.role === 'sales').map((u) => ({ value: u._id, label: lab(u) })),
    admins: d.users.filter((u) => u.role === 'admin').map((u) => ({ value: u._id, label: lab(u) })),
    owners: d.users.map((u) => ({ value: u._id, label: lab(u) })),
    teams: d.teams.map((t) => ({ value: t._id, label: t.name })),
    courses: d.courses.map((c) => ({ value: c._id, label: c.name })),
    customers: d.customers.map((c) => ({ value: c._id, label: `${c.name} (${c.phone})` })),
    leads: d.leads.map((l) => ({ value: l._id, label: `${l.leadId} · ${l.name}` })),
    invoices: d.invoices.map((i) => ({ value: i._id, label: `${i.invoiceNo} · ${i.customer?.name || ''} · due ₹${i.total - i.paid}` })),
  }[key] || []);
  return <Ctx.Provider value={{ ...d, options, reload: load }}>{children}</Ctx.Provider>;
}
