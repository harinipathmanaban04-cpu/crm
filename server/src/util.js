import mongoose from 'mongoose';
export class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
export const httpErr = (s, m) => new HttpError(s, m);
export const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const rx = (s) => new RegExp(esc(s), 'i');
export const normPhone = (p) => String(p || '').replace(/\D/g, '').slice(-10);
export const normEmail = (e) => String(e || '').trim().toLowerCase();
export const isId = (v) => mongoose.isValidObjectId(v);
export const strong = (p) => typeof p === 'string' && p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);
export const sanitize = (o) => {
  if (Array.isArray(o)) return o.map(sanitize);
  if (o && typeof o === 'object') {
    const r = {};
    for (const k of Object.keys(o)) { if (k.startsWith('$') || k.includes('.')) continue; r[k] = sanitize(o[k]); }
    return r;
  }
  return o;
};
export const pick = (o, keys) =>
  Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k] === '' ? null : o[k]]));
export const diff = (before, after, keys) =>
  keys.filter((k) => String(before[k]?._id ?? before[k] ?? '') !== String(after[k]?._id ?? after[k] ?? ''))
    .map((k) => ({ field: k, from: String(before[k]?._id ?? before[k] ?? ''), to: String(after[k]?._id ?? after[k] ?? '') }));
export const endOfToday = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; };
