import api from './api';
import { useFetch } from './useFetch';
import { EV, useLive } from './realtime';

/** Dropdown data from the same `/lookups` endpoint the website uses (courses, own customers, open invoices). */
export function useLookups() {
  const f = useFetch(async () => (await api.get('/lookups')).data, []);
  useLive([...EV.customer, ...EV.adm, ...EV.pay], f.reload);
  const d = f.data || {};
  return {
    ...f,
    courses: (d.courses || []).map((c) => ({ value: c._id, label: c.name, fee: c.fee })),
    customers: (d.customers || []).map((c) => ({ value: c._id, label: `${c.name} · ${c.phone}` })),
    invoices: (d.invoices || []).map((i) => ({ value: i._id, label: `${i.invoiceNo} · ${i.customer?.name || ''}`, total: i.total, paid: i.paid })),
  };
}
