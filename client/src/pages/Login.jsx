import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { errMsg } from '../api';

export default function Login() {
  const { user, login } = useAuth(); const nav = useNavigate(); const [sp] = useSearchParams();
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [err, setErr] = useState(sp.get('expired') ? 'Your session expired. Please sign in again.' : ''); const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={user.mustChangePassword ? '/change-password' : '/'} replace />;
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { const u = await login(email, pw); nav(u?.mustChangePassword ? '/change-password' : '/'); } catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
  };
  return (
    <div className="flex min-h-screen items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #EDFAFA 0%, #ffffff 50%, #FFF3F0 100%)' }}>
      <div className="card w-full max-w-md p-8" style={{ borderTop: '4px solid #23AAA7' }}>
        <div className="mb-6 flex flex-col items-center text-center">
          <img src="/logo.png" alt="Eco Friendly Tech Solutions" className="h-28 w-auto object-contain mb-3 drop-shadow-sm" />
          <p className="text-sm text-gray-500">Sign in to your CRM workspace</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {err && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</div>}
          <div><label className="label">Email</label><input className="input" type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@gmail.com" /></div>
          <div><label className="label">Password</label>
            <input className="input" type="password" autoComplete="current-password" required value={pw} onChange={(e) => setPw(e.target.value)} /></div>
          <button className="btn btn-primary w-full py-2.5 text-base" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <p className="mt-5 text-center text-xs text-gray-400">Access is limited to accounts created by the Super Admin.</p>
      </div>
    </div>
  );
}
