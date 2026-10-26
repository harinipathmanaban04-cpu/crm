// Pure helpers (no React Native imports) so they can be unit tested with plain Node.
export const API_PORT = 5000;

/** Decide the backend base URL (without /api). */
export function resolveApiBase({ envUrl, hostUri, isDev, platform }) {
  if (envUrl && envUrl.trim()) return envUrl.trim().replace(/\/+$/, '').replace(/\/api$/, '');
  if (isDev && hostUri) {
    const host = String(hostUri).replace(/^[a-z]+:\/\//, '').split(':')[0].split('/')[0];
    if (host) return `http://${host}:${API_PORT}`; // physical phone on the same Wi-Fi as the dev PC
  }
  return platform === 'android' ? `http://10.0.2.2:${API_PORT}` : `http://localhost:${API_PORT}`; // 10.0.2.2 = host PC from the Android emulator
}

/** Digits-only phone for wa.me / tel. 10-digit local numbers get the default country code. */
export function waNumber(phone, cc = '91') {
  const d = String(phone || '').replace(/\D/g, '');
  if (!d) return '';
  return d.length === 10 ? cc + d : d.replace(/^0+/, '');
}
export const telUrl = (p) => `tel:${String(p || '').replace(/[^\d+]/g, '')}`;
export const waUrl = (p, text = '', cc = '91') => `https://wa.me/${waNumber(p, cc)}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
export const mailUrl = (e, subject = '') => `mailto:${e}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;
