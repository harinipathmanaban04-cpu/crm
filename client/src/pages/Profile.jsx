import { useState, useRef } from 'react';
import { LogOut, Camera, Trash2, Upload } from 'lucide-react';
import api, { errMsg } from '../api';
import { useAuth } from '../auth.jsx';
import { Badge, fmtDT, roleLabel, toast, useCardSelection, LOGO_PALETTE } from '../ui.jsx';
import { PasswordForm } from './ChangePassword.jsx';

export default function Profile() {
  const { user, reload, logout } = useAuth();
  const { selectedId, selectCard } = useCardSelection();
  const [f, setF] = useState({ name: user.name, phone: user.phone || '' });
  const [avatar, setAvatar] = useState(user.avatar || null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef(null);

  const canChangePassword = user.role === 'superadmin';

  const teamObj = user.team && typeof user.team === 'object' ? user.team : null;
  const teamName = teamObj?.name || (typeof user.team === 'string' ? user.team : '—');
  const adminObj = teamObj?.admin && typeof teamObj.admin === 'object' ? teamObj.admin : null;
  const adminName = adminObj?.name || (typeof teamObj?.admin === 'string' ? teamObj.admin : null);
  const adminEmail = adminObj?.email || null;
  const adminPhone = adminObj?.phone || null;

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast('Please select an image file', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast('Image must be under 5MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 256;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        setAvatar(dataUrl);
        toast('Photo chosen. Click "Save changes" to apply.');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setAvatar(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    toast('Photo removed. Click "Save changes" to apply.');
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.put('/auth/profile', { ...f, avatar });
      await reload();
      toast('Profile updated successfully');
    } catch (x) {
      toast(errMsg(x), 'error');
    } finally {
      setBusy(false);
    }
  };

  const containerClass = canChangePassword ? 'max-w-4xl' : 'max-w-xl';

  return (
    <div className={`mx-auto ${containerClass} space-y-5 px-1 py-1 sm:py-2`}>
      {/* Header: aligned with card borders */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-0.5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">My Profile</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Manage your personal profile details and account information
          </p>
        </div>
        <div className="self-start sm:self-center">
          <Badge tone={user.role === 'superadmin' ? 'teal' : undefined}>{roleLabel(user.role)}</Badge>
        </div>
      </div>

      <div className={`grid gap-5 ${canChangePassword ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
        <form
          onSubmit={save}
          onClick={(e) => {
            if (e.target.closest('button, a, input, select, textarea, label')) return;
            selectCard('profile-info');
          }}
          className="card space-y-4.5 p-5 sm:p-6 transition-all duration-300 cursor-pointer hover:shadow-sm"
          style={{
            borderTop: selectedId === 'profile-info' ? `4.5px solid ${LOGO_PALETTE.teal}` : `4px solid ${LOGO_PALETTE.teal}`,
            boxShadow: selectedId === 'profile-info' ? `0 4px 14px -2px ${LOGO_PALETTE.teal}33` : undefined,
          }}
        >
          {/* Avatar & Photo Upload Section */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 pb-4 border-b border-gray-100">
            <div className="relative group shrink-0 self-start sm:self-center">
              {avatar ? (
                <img
                  src={avatar}
                  alt={user.name}
                  className="h-16 w-16 rounded-full object-cover border-2 border-brand-500 shadow-sm"
                />
              ) : (
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-full text-white text-xl font-bold shadow-sm"
                  style={{ background: 'linear-gradient(135deg, #FD7B69 0%, #23AAA7 100%)' }}
                >
                  {user.name[0]}
                </div>
              )}
              <label
                htmlFor="avatar-file"
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-white shadow hover:bg-brand-600 cursor-pointer transition"
                title="Upload profile photo"
              >
                <Camera className="h-3.5 w-3.5" />
                <input
                  id="avatar-file"
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </label>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-base text-gray-900 truncate">{user.name}</p>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <Badge tone={user.role === 'superadmin' ? 'teal' : undefined}>{roleLabel(user.role)}</Badge>
                {avatar && (
                  <button
                    type="button"
                    onClick={removeImage}
                    className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition"
                  >
                    <Trash2 className="h-3 w-3" /> Remove
                  </button>
                )}
              </div>
              <label
                htmlFor="avatar-file"
                className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium text-brand-600 hover:text-brand-700 cursor-pointer transition"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Upload image</span>
              </label>
            </div>
          </div>

          <div>
            <label className="label">Full name</label>
            <input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="e.g. +91 9876543210" />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" disabled value={user.email} />
          </div>

          {/* Team & Admin Details Box */}
          <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3.5 space-y-2.5 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-gray-500 font-medium">Team:</span>
                <b className="text-gray-900 font-semibold">{teamName}</b>

                {user.role === 'sales' && (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 border border-teal-200/80 px-2.5 py-0.5 text-xs font-medium text-teal-800 shadow-2xs"
                    title={adminEmail ? `Team Admin: ${adminName} (${adminEmail})` : `Team Admin: ${adminName || 'Not Assigned'}`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-teal-500"></span>
                    <span>Admin:</span>
                    <b className="font-semibold text-teal-900">{adminName || 'Not Assigned'}</b>
                  </span>
                )}

                {user.role === 'admin' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 border border-teal-200/80 px-2.5 py-0.5 text-xs font-medium text-teal-800 shadow-2xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-teal-500"></span>
                    Team Admin
                  </span>
                )}
              </div>

              <div className="text-xs text-gray-500">
                <span>Last login: </span>
                <b className="text-gray-700 font-medium">{fmtDT(user.lastLogin)}</b>
              </div>
            </div>

            {user.role === 'sales' && adminName && (
              <div className="flex items-center gap-2 pt-2 border-t border-gray-200/60 text-xs text-gray-500 flex-wrap">
                <span className="text-gray-400">Reporting to Admin:</span>
                <span className="font-medium text-gray-800">{adminName}</span>
                {adminEmail && <span className="text-gray-400">({adminEmail})</span>}
                {adminPhone && <span className="text-gray-400">• {adminPhone}</span>}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={logout}>
              <LogOut className="h-4 w-4" />Logout
            </button>
          </div>
        </form>

        {/* Change password card ONLY for Super Admin */}
        {canChangePassword && (
          <div
            onClick={(e) => {
              if (e.target.closest('button, a, input, select, textarea')) return;
              selectCard('change-password');
            }}
            className="card p-5 sm:p-6 transition-all duration-300 cursor-pointer hover:shadow-sm"
            style={{
              borderTop: selectedId === 'change-password' ? `4.5px solid ${LOGO_PALETTE.coral}` : `4px solid ${LOGO_PALETTE.coral}`,
              boxShadow: selectedId === 'change-password' ? `0 4px 14px -2px ${LOGO_PALETTE.coral}33` : undefined,
            }}
          >
            <h2 className="mb-4 font-semibold transition-colors duration-300" style={{ color: selectedId === 'change-password' ? LOGO_PALETTE.coral : undefined }}>
              Change password
            </h2>
            <PasswordForm />
          </div>
        )}
      </div>
    </div>
  );
}
