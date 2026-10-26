export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
export function timeAgo(d) {
  const s = Math.max(0, (Date.now() - new Date(d)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return fmtDate(d);
}
/** 'overdue' | 'today' | 'upcoming' | null for a follow-up / due date */
export function dueState(d) {
  if (!d) return null;
  const t = new Date(d); const end = new Date(); end.setHours(23, 59, 59, 999);
  const start = new Date(); start.setHours(0, 0, 0, 0);
  if (t < start) return 'overdue';
  return t <= end ? 'today' : 'upcoming';
}
export const addDays = (n, hour = 10) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(hour, 0, 0, 0); return d; };
export const initials = (n = '?') => n.trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
export const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
export const toIsoDate = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
