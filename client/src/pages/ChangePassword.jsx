import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import api, { errMsg } from '../api';
import { useAuth } from '../auth.jsx';
import { toast } from '../ui.jsx';

export function PasswordForm({ onDone }) {
  const { applySession } = useAuth();
  const [f, setF] = useState({ currentPassword: '', newPassword: '', confirm: '' }); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    if (f.newPassword !== f.confirm) return toast('Passwords do not match', 'error');
    setBusy(true);
    try { const { data } = await api.post('/auth/change-password', { currentPassword: f.currentPassword, newPassword: f.newPassword }); applySession(data); toast('Password changed'); setF({ currentPassword: '', newPassword: '', confirm: '' }); onDone?.(); }
    catch (x) { toast(errMsg(x), 'error'); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <div><label className="label">Current / temporary password</label><input className="input" type="password" required value={f.currentPassword} onChange={set('currentPassword')} /></div>
      <div><label className="label">New password</label><input className="input" type="password" required minLength={8} value={f.newPassword} onChange={set('newPassword')} /><p className="mt-1 text-xs text-gray-400">8+ characters with letters and numbers</p></div>
      <div><label className="label">Confirm new password</label><input className="input" type="password" required value={f.confirm} onChange={set('confirm')} /></div>
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button>
    </form>
  );
}
export default function ChangePassword() {
  const { user, logout } = useAuth(); const nav = useNavigate();
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="card w-full max-w-md p-8">
        <div className="mb-5 flex items-center gap-3"><div className="rounded-xl bg-brand-100 p-2.5"><KeyRound className="h-5 w-5 text-brand-600" /></div>
          <div><h1 className="font-semibold">Set a new password</h1><p className="text-sm text-gray-500">{user.mustChangePassword ? 'Your temporary password must be changed before continuing.' : 'Update your password.'}</p></div></div>
        <PasswordForm onDone={() => nav('/')} />
        <button className="mt-4 text-sm text-gray-500 underline" onClick={logout}>Sign out</button>
      </div>
    </div>
  );
}
