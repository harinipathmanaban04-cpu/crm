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

export function amountToIndianWords(num) {
  num = Math.round(Number(num) || 0);
  if (num === 0) return 'Zero Only';
  if (num < 0) return 'Minus ' + amountToIndianWords(Math.abs(num));

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertTwoDigits(n) {
    if (n === 0) return '';
    if (n < 20) return a[n];
    const tens = b[Math.floor(n / 10)];
    const ones = a[n % 10];
    return tens + (ones ? ' ' + ones : '');
  }

  function convertThreeDigits(n) {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    let res = '';
    if (hundred > 0) {
      res += a[hundred] + ' Hundred';
      if (rest > 0) res += ' ';
    }
    if (rest > 0) {
      res += convertTwoDigits(rest);
    }
    return res;
  }

  let words = '';
  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  const hundredAndRest = num;

  if (crore > 0) {
    words += (words ? ' ' : '') + convertThreeDigits(crore) + ' Crore';
  }
  if (lakh > 0) {
    words += (words ? ' ' : '') + convertThreeDigits(lakh) + ' Lakh';
  }
  if (thousand > 0) {
    words += (words ? ' ' : '') + convertThreeDigits(thousand) + ' Thousand';
  }
  if (hundredAndRest > 0) {
    words += (words ? ' ' : '') + convertThreeDigits(hundredAndRest);
  }

  return (words.trim() + ' Only').replace(/\s+/g, ' ');
}
