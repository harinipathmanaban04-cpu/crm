import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, UserPlus, PhoneCall, UserCheck, Ban, CheckCircle2, KeyRound, Check, FileDown, Upload, Download, Users, CheckSquare, Square, X, AlertCircle, AlertTriangle, Trash2, FileSpreadsheet, Plus, Mail, Printer, Loader2 } from 'lucide-react';
import api, { errMsg } from '../api';
import { useAuth } from '../auth.jsx';
import { useLookups } from '../lookups.jsx';
import { EV } from '../socket.jsx';
import ResourcePage from '../ResourcePage.jsx';
import { Badge, Modal, Spinner, fmt, fmtDT, inr, roleLabel, toast, LEAD_STATUS_LIST } from '../ui.jsx';
import { downloadAccountsPdf } from '../exportPdf.js';
import NewInvoiceModal from './NewInvoiceModal.jsx';

const o = (a) => a.map((x) => ({ value: x, label: x }));
const SOURCES = o(['Website', 'Walk-in', 'Referral', 'Social Media', 'Phone Enquiry', 'Campaign', 'Direct']);
const PRIOS = o(['Low', 'Medium', 'High']);
const nm = (x) => x?.name || '—';
const Two = ({ a, b }) => <div><p className="font-medium">{a}</p>{b && <p className="text-xs text-gray-400">{b}</p>}</div>;
const tabs = (list, cur, set) => <div className="flex gap-1 border-b border-gray-200">{list.map((t) => <button key={t} onClick={() => set(t)} className={`px-4 py-2 text-sm font-medium transition-colors ${cur === t ? 'border-b-2 border-coral-500 text-coral-600 font-semibold' : 'text-gray-500 hover:text-gray-700'}`}>{t}</button>)}</div>;

function PasswordBadge({ pwd }) {
  const [show, setShow] = useState(false);
  const isSet = Boolean(pwd && pwd !== 'Not Set');
  const val = pwd || 'Not Set';

  if (!isSet) {
    return <span className="text-[11px] text-gray-400 italic">Not recorded</span>;
  }

  return (
    <div className="flex items-center gap-1.5 font-mono text-xs" onClick={(e) => e.stopPropagation()}>
      <span className={`px-2 py-0.5 rounded text-[11px] ${show ? 'bg-brand-50 text-brand-700 font-semibold select-all' : 'bg-gray-100 text-gray-500'}`}>
        {show ? val : '••••••••'}
      </span>
      <button
        type="button"
        className="icon-btn p-1 text-gray-400 hover:text-gray-700"
        onClick={() => setShow(!show)}
        title={show ? 'Hide password' : 'Show password'}
      >
        {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

/* ---------------- Accounts (Super Admin) ---------------- */
export function Accounts() {
  const [tick, setTick] = useState(0);
  const [rp, setRp] = useState(null);
  const [pw, setPw] = useState('');
  const [downloading, setDownloading] = useState(false);

  const handleDownloadPdf = async () => {
    try {
      setDownloading(true);
      toast('Preparing accounts PDF report…');
      const res = await api.get('/users', { params: { limit: 1000, includeSuper: 'true' } });
      const users = res.data?.items || [];
      if (!users.length) {
        toast('No accounts found to download', 'error');
        return;
      }
      downloadAccountsPdf(users);
      toast(`Downloaded PDF with ${users.length} accounts!`);
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <ResourcePage
        title="Account"
        subtitle="Create and manage Admin and Sales Executive accounts"
        endpoint="/users"
        newLabel="Create Account"
        headerActions={
          <button
            type="button"
            className="btn btn-teal flex items-center gap-2 shadow-sm text-xs sm:text-sm"
            onClick={handleDownloadPdf}
            disabled={downloading}
            title="Download PDF directory of all accounts and passwords"
          >
            <FileDown className="h-4 w-4" />
            <span>{downloading ? 'Generating PDF…' : 'Download PDF'}</span>
          </button>
        }
        canCreate
        canEdit
        canDelete={(r, u) => r.role !== 'superadmin' && String(r._id) !== String(u?._id)}
        refreshKey={tick}
        events={[...EV.team, 'user:updated']}
        dateFilter={false}
        filters={[
          { key: 'role', label: 'Role', options: [{ value: 'admin', label: 'Admin' }, { value: 'sales', label: 'Sales Executive' }] },
          { key: 'active', label: 'Status', options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }] },
          { key: 'team', label: 'Team', optionsKey: 'teams' },
        ]}
        columns={[
          { label: 'Name', render: (r) => <Two a={r.name} b={r.email} /> },
          { label: 'Role', render: (r) => <Badge>{r.role}</Badge> },
          { label: 'Team', render: (r) => nm(r.team) },
          { label: 'Status', render: (r) => <Badge tone={r.active ? 'green' : 'gray'}>{r.active ? 'Active' : 'Inactive'}</Badge> },
          { label: 'Last login', render: (r) => fmtDT(r.lastLogin) },
          { label: 'Password', render: (r) => <PasswordBadge pwd={r.plainPassword} /> },
        ]}
        fields={[
          { name: 'name', label: 'Full name', required: true },
          { name: 'email', label: 'Gmail / email', type: 'email', required: true },
          { name: 'phone', label: 'Phone', type: 'tel' },
          { name: 'role', label: 'Role', type: 'select', required: true, options: [{ value: 'admin', label: 'Admin' }, { value: 'sales', label: 'Sales Executive' }] },
          { name: 'team', label: 'Team', type: 'select', optionsKey: 'teams', hint: 'Assigning an Admin replaces the team’s current Admin' },
          { name: 'password', label: 'Password', required: true, createOnly: true, hint: '8+ characters with letters & numbers' },
          { name: 'newPassword', label: 'New password', editOnly: true, hint: 'Leave blank to keep the current password' },
        ]}
        actions={(r) => (
          <>
            <button className="icon-btn" title="Edit password" onClick={() => { setRp(r); setPw(''); }}><KeyRound className="h-4 w-4" /></button>
            <button
              className={`icon-btn ${r.active ? 'hover:text-red-600' : 'hover:text-green-600'}`}
              title={r.active ? 'Deactivate' : 'Activate'}
              onClick={async () => {
                try {
                  await api.post(`/users/${r._id}/toggle`);
                  toast(r.active ? 'Account deactivated' : 'Account activated');
                  setTick((t) => t + 1);
                } catch (e) {
                  toast(errMsg(e), 'error');
                }
              }}
            >
              {r.active ? <Ban className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            </button>
          </>
        )}
      />
      {rp && (
        <Modal title={`Edit password — ${rp.name}`} onClose={() => setRp(null)}>
          <label className="label">New password</label>
          <input className="input" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="8+ characters, letters & numbers" />
          <p className="mt-1 text-xs text-gray-400">The user is signed out and can log in with this new password.</p>
          <div className="mt-5 flex justify-end gap-2">
            <button className="btn btn-ghost" onClick={() => setRp(null)}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={async () => {
                try {
                  await api.post(`/users/${rp._id}/reset-password`, { password: pw });
                  toast('Password updated');
                  setRp(null);
                  setTick((t) => t + 1);
                } catch (e) {
                  toast(errMsg(e), 'error');
                }
              }}
            >
              Reset
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

/* ---------------- Leads / Follow-ups ---------------- */
function LeadDetail({ id, onClose }) {
  const [l, setL] = useState(null);
  useEffect(() => { api.get(`/leads/${id}`).then((r) => setL(r.data)).catch((e) => { toast(errMsg(e), 'error'); onClose(); }); }, [id]);
  return (
    <Modal title="Lead details" onClose={onClose} wide>
      {!l ? <Spinner /> : (
        <div className="space-y-5 text-sm">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Lead ID', l.leadId],
              ['Name', l.name],
              ['Mobile Number', l.phone],
              ['Email / Gmail', l.email || '—'],
              ['Address', l.address || '—'],
              ['Course', nm(l.course)],
              ['Source', l.source],
              ['Team', nm(l.team)],
              ['Admin', nm(l.admin)],
              ['Assigned to', nm(l.assignedTo)],
              ['Priority', l.priority],
              ['Next follow-up', fmt(l.nextFollowUp)],
              ['Created by', nm(l.createdBy)],
              ['Created', fmtDT(l.createdAt)],
              ['Updated', fmtDT(l.updatedAt)],
            ].map(([k, v]) => {
              const isEmail = k.includes('Email');
              const isAddress = k === 'Address';
              return (
                <div key={k} className={isAddress ? 'sm:col-span-2' : ''}>
                  <p className="text-xs font-medium text-gray-500 mb-0.5">{k}</p>
                  {isEmail && v !== '—' ? (
                    <a
                      href={`mailto:${v}`}
                      className="font-medium text-brand-600 hover:text-brand-700 hover:underline break-all block"
                      title={v}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {v}
                    </a>
                  ) : (
                    <p className={`font-medium text-gray-900 ${isAddress ? 'break-words' : 'break-all'}`}>
                      {v}
                    </p>
                  )}
                </div>
              );
            })}
            <div><p className="text-xs font-medium text-gray-500 mb-0.5">Status</p><Badge>{l.status}</Badge></div>
          </div>
          {l.notes && <div><p className="text-xs font-medium text-gray-500 mb-0.5">Notes</p><p className="rounded-lg bg-gray-50 p-3 text-gray-800 break-words">{l.notes}</p></div>}
          <div><h4 className="mb-2 font-semibold">Assignment history</h4>{l.history?.length ? <ul className="space-y-1 text-gray-600">{[...l.history].reverse().map((h, i) => <li key={i}>{fmtDT(h.at)} — {h.type}{h.from ? ` from ${nm(h.from)}` : ''}{h.to ? ` to ${nm(h.to)}` : ''} <span className="text-gray-400">by {nm(h.by)}</span></li>)}</ul> : <p className="text-gray-400">None</p>}</div>
          <div><h4 className="mb-2 font-semibold">Follow-up activity</h4>{l.followUps?.length ? <ul className="space-y-1 text-gray-600">{[...l.followUps].reverse().map((h, i) => <li key={i}>{fmtDT(h.date)} — {h.note} <span className="text-gray-400">by {nm(h.by)}</span></li>)}</ul> : <p className="text-gray-400">No follow-ups logged</p>}</div>
        </div>
      )}
    </Modal>
  );
}
export function LeadsPage({ mode }) {
  const { user } = useAuth();
  const lk = useLookups();
  const staff = user.role !== 'sales';
  const isSA = user.role === 'superadmin';
  const isAdmin = user.role === 'admin';
  const fu = mode === 'followups';

  // Single-lead modals
  const [view, setView] = useState(null);
  const [assign, setAssign] = useState(null);
  const [follow, setFollow] = useState(null);
  const [val, setVal] = useState('');
  const [fd, setFd] = useState({ note: '', next: '', status: '' });
  const [tick, setTick] = useState(0);

  // Bulk selection
  const [selected, setSelected] = useState(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);

  // Bulk assign to Admin modal (SuperAdmin only)
  const [bulkAdminModal, setBulkAdminModal] = useState(false);
  const [bulkAdminId, setBulkAdminId] = useState('');
  const [bulkAdminLoading, setBulkAdminLoading] = useState(false);

  // Bulk assign to Sales modal (Admin + SuperAdmin)
  const [bulkSalesModal, setBulkSalesModal] = useState(false);
  const [bulkSalesId, setBulkSalesId] = useState('');
  const [bulkSalesLoading, setBulkSalesLoading] = useState(false);

  // Import Excel modal
  const [importModal, setImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  const act = async (fn, msg, close) => {
    try { await fn(); toast(msg); close(); setTick((t) => t + 1); }
    catch (e) { toast(errMsg(e), 'error'); }
  };

  // Toggle a lead in/out of selection
  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Select or deselect all leads on the current page
  const handleSelectAll = (pageIds, select) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (select) {
        pageIds.forEach((id) => next.add(id));
      } else {
        pageIds.forEach((id) => next.delete(id));
      }
      return next;
    });
  };

  // Synchronize selection when a lead is individually deleted
  const handleDeleteSuccess = (id) => {
    setSelected((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // Perform bulk deletion of selected leads
  const doBulkDelete = async () => {
    if (!selected.size) return;
    setBulkDeleteLoading(true);
    try {
      const countToDelete = selected.size;
      const res = await api.post('/leads/bulk-delete', { leadIds: [...selected] });
      const count = res.data.deletedCount ?? countToDelete;
      toast(`Successfully deleted ${count} lead${count !== 1 ? 's' : ''}`);
      setSelected(new Set());
      setBulkDeleteConfirm(false);
      setTick((t) => t + 1);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  // Handle file selection for import
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportPreview(null);
    setImportResults(null);
    setImportLoading(true);
    try {
      const base64 = await fileToBase64(file);
      const res = await api.post('/leads/import/preview', { data: base64 });
      setImportPreview(res.data);
    } catch (e) {
      toast(errMsg(e), 'error');
      setImportFile(null);
    } finally {
      setImportLoading(false);
    }
  };

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const doImport = async () => {
    if (!importFile) return;
    setImportLoading(true);
    try {
      const base64 = await fileToBase64(importFile);
      const res = await api.post('/leads/import', { data: base64, skipDuplicates });
      setImportResults(res.data);
      setTick((t) => t + 1);
      toast(`Import complete: ${res.data.imported} leads imported`);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setImportLoading(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const res = await api.get('/leads/import/template', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = 'leads-import-template.xlsx';
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  const doBulkAssignAdmin = async () => {
    if (!bulkAdminId || !selected.size) return;
    setBulkAdminLoading(true);
    try {
      const res = await api.post('/leads/bulk-assign-admin', { leadIds: [...selected], adminId: bulkAdminId });
      toast(`${res.data.assigned} lead${res.data.assigned !== 1 ? 's' : ''} assigned to admin`);
      setSelected(new Set());
      setBulkAdminModal(false);
      setBulkAdminId('');
      setTick((t) => t + 1);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBulkAdminLoading(false);
    }
  };

  const doBulkAssignSales = async () => {
    if (!bulkSalesId || !selected.size) return;
    setBulkSalesLoading(true);
    try {
      const res = await api.post('/leads/bulk-assign-sales', { leadIds: [...selected], salesId: bulkSalesId });
      toast(`${res.data.assigned} lead${res.data.assigned !== 1 ? 's' : ''} assigned to sales executive`);
      setSelected(new Set());
      setBulkSalesModal(false);
      setBulkSalesId('');
      setTick((t) => t + 1);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBulkSalesLoading(false);
    }
  };

  const admins = lk.options('admins');
  const salesList = lk.options('sales');

  return (
    <>
      <ResourcePage
        title={fu ? 'Follow-ups' : user.role === 'sales' ? 'My Leads' : 'Lead Management'}
        subtitle={fu ? 'Leads with a follow-up due today or overdue' : 'Create, assign and track leads in real time'}
        endpoint="/leads"
        params={fu ? { followUp: 'due' } : {}}
        refreshKey={tick}
        events={[...EV.lead, ...EV.team]}
        newLabel="New Lead"
        canCreate={staff && !fu}
        canEdit
        canDelete={staff && !fu}
        onRowClick={(r) => setView(r._id)}
        selectable={staff && !fu}
        selected={selected}
        onToggleSelect={toggleSelect}
        onSelectAll={handleSelectAll}
        onClearSelection={() => setSelected(new Set())}
        onDeleteSuccess={handleDeleteSuccess}
        deleteConfirmTitle="Delete Lead"
        deleteConfirmText={(r) => `Are you sure you want to delete lead "${r.name || r.leadId}"? This action cannot be undone.`}
        bulkActions={
          <button
            type="button"
            className="btn btn-danger py-1 px-2.5 text-xs flex items-center gap-1.5 shadow-sm"
            onClick={() => setBulkDeleteConfirm(true)}
            disabled={bulkDeleteLoading}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {bulkDeleteLoading ? 'Deleting…' : `Delete Selected (${selected.size})`}
          </button>
        }
        headerActions={
          staff && !fu ? (
            <div className="flex items-center gap-2 flex-wrap">
              {selected.size > 0 ? (
                <>
                  <span className="text-xs text-gray-500 font-medium hidden sm:inline">
                    {selected.size} lead{selected.size !== 1 ? 's' : ''} selected
                  </span>
                  <button
                    type="button"
                    className="btn btn-danger flex items-center gap-1.5 text-xs shadow-sm"
                    onClick={() => setBulkDeleteConfirm(true)}
                    disabled={bulkDeleteLoading}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {bulkDeleteLoading ? 'Deleting…' : `Delete Selected (${selected.size})`}
                  </button>
                  {isSA && (
                    <button
                      type="button"
                      className="btn btn-teal flex items-center gap-1.5 text-xs"
                      onClick={() => { setBulkAdminModal(true); setBulkAdminId(''); }}
                    >
                      <Users className="h-3.5 w-3.5" />Assign to Admin
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-primary flex items-center gap-1.5 text-xs"
                    onClick={() => { setBulkSalesModal(true); setBulkSalesId(''); }}
                  >
                    <UserPlus className="h-3.5 w-3.5" />Assign to Sales
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost text-xs"
                    onClick={() => setSelected(new Set())}
                  >
                    <X className="h-3.5 w-3.5" />Clear
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost text-gray-400 border-gray-200 flex items-center gap-1.5 text-xs cursor-not-allowed opacity-60"
                  disabled
                  title="Select at least one lead to delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />Delete Selected
                </button>
              )}
              {isSA && (
                <>
                  <button
                    type="button"
                    className="btn btn-ghost flex items-center gap-1.5 text-xs border border-gray-200"
                    onClick={downloadTemplate}
                    title="Download sample Excel template"
                  >
                    <Download className="h-3.5 w-3.5" />Template
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary flex items-center gap-1.5 text-xs"
                    onClick={() => { setImportModal(true); setImportFile(null); setImportPreview(null); setImportResults(null); }}
                  >
                    <Upload className="h-3.5 w-3.5" />Import Excel
                  </button>
                </>
              )}
            </div>
          ) : null
        }
        filters={[
          { key: 'status', label: 'Status', options: o(LEAD_STATUS_LIST) },
          { key: 'priority', label: 'Priority', options: PRIOS },
          { key: 'source', label: 'Source', options: SOURCES },
          { key: 'course', label: 'Course', optionsKey: 'courses' },
          { key: 'assignedTo', label: 'Owner', optionsKey: 'sales', hidden: (u) => u.role === 'sales' },
          { key: 'team', label: 'Team', optionsKey: 'teams', hidden: (u) => u.role !== 'superadmin' },
        ]}
        columns={[
          { label: 'Lead', render: (r) => <Two a={r.name} b={r.leadId} /> },
          { label: 'Course', render: (r) => nm(r.course) },
          { label: 'Email / Gmail', render: (r) => r.email ? <a href={`mailto:${r.email}`} className="text-gray-600 hover:text-brand-600 hover:underline truncate max-w-[180px] sm:max-w-[210px] block font-medium" title={r.email} onClick={(e) => e.stopPropagation()}>{r.email}</a> : <span className="text-gray-400">—</span> },
          { label: 'Mobile Number', render: (r) => r.phone ? <a href={`tel:${r.phone}`} className="whitespace-nowrap font-medium text-gray-700 hover:text-brand-600 hover:underline" onClick={(e) => e.stopPropagation()}>{r.phone}</a> : <span className="text-gray-400">—</span> },
          { label: 'Address', render: (r) => r.address ? <span className="text-gray-600 truncate max-w-[180px] sm:max-w-[210px] block" title={r.address}>{r.address}</span> : <span className="text-gray-400">—</span> },
          { label: 'Source', key: 'source' },
          { label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
          { label: 'Priority', render: (r) => <Badge>{r.priority}</Badge> },
          { label: 'Assigned to', render: (r) => r.assignedTo?.name || <Badge tone="orange">Unassigned</Badge> },
          ...(user.role === 'superadmin' ? [{ label: 'Team', render: (r) => nm(r.team) }] : []),
          { label: 'Follow-up', render: (r) => <span className={r.nextFollowUp && new Date(r.nextFollowUp) < new Date() && !['Converted', 'Lost'].includes(r.status) ? 'font-medium text-red-600' : ''}>{fmt(r.nextFollowUp)}</span> },
        ]}
        fields={[
          { name: 'name', label: 'Student / Customer Name', required: true, placeholder: 'Full Name' },
          { name: 'phone', label: 'Mobile Number', type: 'tel', required: true, placeholder: 'e.g. 9876543210' },
          { name: 'email', label: 'Email / Gmail Address', type: 'email', placeholder: 'student@gmail.com' },
          { name: 'address', label: 'Address', type: 'text', placeholder: 'Complete residential / postal address', allowFileUpload: true },
          { name: 'course', label: 'Interested Course', type: 'select', optionsKey: 'courses' },
          { name: 'source', label: 'Lead Source', type: 'select', options: SOURCES, default: 'Direct' },
          { name: 'priority', label: 'Priority', type: 'select', options: PRIOS, default: 'Medium' },
          { name: 'status', label: 'Status', type: 'select', options: o(LEAD_STATUS_LIST), default: 'New' },
          { name: 'nextFollowUp', label: 'Next Follow-up', type: 'date' },
          { name: 'assignedTo', label: 'Assign to Sales Executive', type: 'select', optionsKey: 'sales', createOnly: true },
          { name: 'team', label: 'Assigned Team', type: 'select', optionsKey: 'teams', createOnly: true, hidden: (v, e, u) => u.role !== 'superadmin' || !!v.assignedTo, hint: 'Used when no Sales Executive is selected' },
          { name: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Additional lead remarks or notes...' },
        ]}
        actions={(r) => (
          <>
            <button className="icon-btn" title="View" onClick={() => setView(r._id)}><Eye className="h-4 w-4" /></button>
            {staff && <button className="icon-btn" title="Assign / reassign" onClick={() => { setAssign(r); setVal(r.assignedTo?._id || ''); }}><UserPlus className="h-4 w-4" /></button>}
            <button className="icon-btn" title="Record follow-up" onClick={() => { setFollow(r); setFd({ note: '', next: '', status: '' }); }}><PhoneCall className="h-4 w-4" /></button>
            {r.status !== 'Converted' && !r.customer && <button className="icon-btn hover:text-green-600" title="Convert to customer" onClick={() => act(() => api.post(`/leads/${r._id}/convert`), 'Converted to customer', () => {})}><UserCheck className="h-4 w-4" /></button>}
          </>
        )}
      />

      {/* Single lead detail modal */}
      {view && <LeadDetail id={view} onClose={() => setView(null)} />}

      {/* Single lead assign modal */}
      {assign && (
        <Modal title={`Assign — ${assign.name}`} onClose={() => setAssign(null)}>
          <label className="label">Sales Executive</label>
          <select className="input" value={val} onChange={(e) => setVal(e.target.value)}>
            <option value="">Select…</option>
            {lk.options('sales').map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
          </select>
          <div className="mt-5 flex justify-end gap-2">
            <button className="btn btn-ghost" onClick={() => setAssign(null)}>Cancel</button>
            <button className="btn btn-primary" disabled={!val} onClick={() => act(() => api.post(`/leads/${assign._id}/assign`, { assignedTo: val }), 'Lead assigned', () => setAssign(null))}>Assign</button>
          </div>
        </Modal>
      )}

      {/* Follow-up modal */}
      {follow && (
        <Modal title={`Follow-up — ${follow.name}`} onClose={() => setFollow(null)}>
          <div className="space-y-4">
            <div><label className="label">What happened? *</label><textarea className="input" rows={3} value={fd.note} onChange={(e) => setFd({ ...fd, note: e.target.value })} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="label">Next follow-up date</label><input type="date" className="input" value={fd.next} onChange={(e) => setFd({ ...fd, next: e.target.value })} /></div>
              <div><label className="label">Update status</label><select className="input" value={fd.status} onChange={(e) => setFd({ ...fd, status: e.target.value })}><option value="">Keep ({follow.status})</option>{LEAD_STATUS_LIST.map((s) => <option key={s}>{s}</option>)}</select></div>
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setFollow(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={!fd.note.trim()} onClick={() => act(() => api.post(`/leads/${follow._id}/followup`, fd), 'Follow-up saved', () => setFollow(null))}>Save</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Bulk assign to Admin modal (SuperAdmin only) */}
      {bulkAdminModal && (
        <Modal title={`Assign ${selected.size} lead${selected.size !== 1 ? 's' : ''} to Admin`} onClose={() => setBulkAdminModal(false)}>
          <p className="mb-3 text-sm text-gray-500">The leads will become visible to the selected Admin's team.</p>
          <label className="label">Select Admin *</label>
          <select className="input" value={bulkAdminId} onChange={(e) => setBulkAdminId(e.target.value)}>
            <option value="">Choose an Admin…</option>
            {admins.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
          </select>
          <div className="mt-5 flex justify-end gap-2">
            <button className="btn btn-ghost" onClick={() => setBulkAdminModal(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={!bulkAdminId || bulkAdminLoading} onClick={doBulkAssignAdmin}>
              {bulkAdminLoading ? 'Assigning…' : 'Assign to Admin'}
            </button>
          </div>
        </Modal>
      )}

      {/* Bulk assign to Sales modal (Admin + SuperAdmin) */}
      {bulkSalesModal && (
        <Modal title={`Assign ${selected.size} lead${selected.size !== 1 ? 's' : ''} to Sales Executive`} onClose={() => setBulkSalesModal(false)}>
          <label className="label">Select Sales Executive *</label>
          <select className="input" value={bulkSalesId} onChange={(e) => setBulkSalesId(e.target.value)}>
            <option value="">Choose a Sales Executive…</option>
            {salesList.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
          </select>
          <div className="mt-5 flex justify-end gap-2">
            <button className="btn btn-ghost" onClick={() => setBulkSalesModal(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={!bulkSalesId || bulkSalesLoading} onClick={doBulkAssignSales}>
              {bulkSalesLoading ? 'Assigning…' : 'Assign to Sales'}
            </button>
          </div>
        </Modal>
      )}

      {/* Bulk Delete Confirm Modal */}
      {bulkDeleteConfirm && (
        <Modal title="Confirm Bulk Delete" onClose={() => !bulkDeleteLoading && setBulkDeleteConfirm(false)}>
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-lg bg-red-50 p-3.5 text-red-800">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-600 mt-0.5" />
              <p className="text-sm font-medium">
                Are you sure you want to delete the {selected.size} selected lead{selected.size !== 1 ? 's' : ''}? This action cannot be undone.
              </p>
            </div>
            <p className="text-xs text-gray-500">
              All data, assignment history, and follow-ups associated with these {selected.size} selected lead{selected.size !== 1 ? 's' : ''} will be permanently removed from the database.
            </p>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={bulkDeleteLoading}
              onClick={() => setBulkDeleteConfirm(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger flex items-center gap-1.5"
              disabled={bulkDeleteLoading}
              onClick={doBulkDelete}
            >
              {bulkDeleteLoading ? (
                <>
                  <Spinner className="h-4 w-4" /> Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" /> Delete {selected.size} Lead{selected.size !== 1 ? 's' : ''}
                </>
              )}
            </button>
          </div>
        </Modal>
      )}

      {/* Import Excel modal */}
      {importModal && (
        <Modal title="Import Leads from Excel / CSV" onClose={() => setImportModal(false)} wide>
          <div className="space-y-4 text-sm">
            {!importResults ? (
              <>
                <div className="rounded-lg border-2 border-dashed border-gray-200 p-6 text-center">
                  <FileSpreadsheet className="mx-auto mb-2 h-10 w-10 text-gray-300" />
                  <p className="text-gray-500 mb-3">Select an Excel (.xlsx) or CSV file</p>
                  <label className="btn btn-primary cursor-pointer inline-flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    {importFile ? 'Change File' : 'Choose File'}
                    <input type="file" accept=".xlsx,.csv,.xls" className="hidden" onChange={handleFileChange} />
                  </label>
                  {importFile && <p className="mt-2 text-xs text-gray-400">{importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)</p>}
                </div>

                {importLoading && <div className="flex items-center gap-2 text-gray-500"><Spinner /><span>Analysing file…</span></div>}

                {importPreview && !importLoading && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-gray-700">
                        <span className="text-green-600 font-bold">{importPreview.totalRows}</span> rows detected
                      </p>
                      {importPreview.missingRequired?.length > 0 && (
                        <span className="flex items-center gap-1 text-amber-600 text-xs font-medium">
                          <AlertCircle className="h-3.5 w-3.5" />
                          Missing columns: {importPreview.missingRequired.join(', ')}
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-gray-500">
                      <span className="font-medium">Mapped columns: </span>
                      {Object.values(importPreview.mappedColumns).join(', ') || 'None detected'}
                    </div>

                    {importPreview.preview?.length > 0 && (
                      <div className="overflow-x-auto rounded border border-gray-200">
                        <table className="min-w-full text-xs">
                          <thead className="bg-gray-50">
                            <tr>
                              {Object.keys(importPreview.preview[0]).filter((k) => k !== '_rowNum').map((k) => (
                                <th key={k} className="px-2 py-1.5 text-left font-medium text-gray-600 capitalize">{k}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {importPreview.preview.map((row, i) => (
                              <tr key={i} className="border-t border-gray-100">
                                {Object.entries(row).filter(([k]) => k !== '_rowNum').map(([k, v]) => (
                                  <td key={k} className="px-2 py-1.5 text-gray-700 max-w-[150px] truncate">{v || '—'}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {importPreview.totalRows > 5 && (
                          <p className="px-2 py-1.5 text-xs text-gray-400 bg-gray-50 border-t border-gray-100">
                            Showing first 5 of {importPreview.totalRows} rows
                          </p>
                        )}
                      </div>
                    )}

                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={skipDuplicates} onChange={(e) => setSkipDuplicates(e.target.checked)} className="rounded" />
                      <span>Skip duplicate leads (same phone/email already in database)</span>
                    </label>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button className="btn btn-ghost" onClick={() => setImportModal(false)}>Cancel</button>
                  <button
                    className="btn btn-primary flex items-center gap-2"
                    disabled={!importPreview || importLoading || importPreview.missingRequired?.length > 0}
                    onClick={doImport}
                  >
                    {importLoading ? <><Spinner />Importing…</> : <><Upload className="h-4 w-4" />Import {importPreview?.totalRows || ''} Leads</>}
                  </button>
                </div>
              </>
            ) : (
              /* Import Results */
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                    <p className="text-2xl font-bold text-green-600">{importResults.imported}</p>
                    <p className="text-xs text-green-700 mt-1">Imported</p>
                  </div>
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                    <p className="text-2xl font-bold text-amber-600">{importResults.duplicates}</p>
                    <p className="text-xs text-amber-700 mt-1">Duplicates skipped</p>
                  </div>
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                    <p className="text-2xl font-bold text-red-600">{importResults.failed}</p>
                    <p className="text-xs text-red-700 mt-1">Failed</p>
                  </div>
                </div>

                {importResults.errors?.length > 0 && (
                  <div>
                    <p className="font-medium text-gray-700 mb-2 text-sm">Issues ({importResults.errors.length})</p>
                    <div className="max-h-48 overflow-y-auto rounded border border-gray-200 bg-gray-50">
                      {importResults.errors.map((e, i) => (
                        <div key={i} className="px-3 py-1.5 text-xs border-b border-gray-100 last:border-0">
                          <span className="font-medium text-gray-600">Row {e.row}: </span>
                          <span className="text-red-600">{e.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <button className="btn btn-ghost" onClick={() => { setImportFile(null); setImportPreview(null); setImportResults(null); }}>Import Another</button>
                  <button className="btn btn-primary" onClick={() => setImportModal(false)}>Done</button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

/* ---------------- Tasks ---------------- */
export function TasksPage() {
  const { user } = useAuth(); const staff = user.role !== 'sales'; const [tick, setTick] = useState(0);
  const od = (r) => ['To Do', 'In Progress'].includes(r.status) && r.dueDate && new Date(r.dueDate) < new Date();
  return (
    <ResourcePage title={user.role === 'sales' ? 'My Tasks' : 'Task Management'} subtitle="Assign and track work for Sales Executives" endpoint="/tasks" refreshKey={tick} events={[...EV.task, ...EV.team]} newLabel="New Task" canCreate canEdit canDelete={staff}
      filters={[{ key: 'status', label: 'Status', options: o(['To Do', 'In Progress', 'Completed', 'Cancelled']) }, { key: 'priority', label: 'Priority', options: PRIOS }, { key: 'overdue', label: 'Due', options: [{ value: '1', label: 'Overdue only' }] }, { key: 'assignee', label: 'Assignee', optionsKey: 'sales', hidden: (u) => u.role === 'sales' }]}
      columns={[{ label: 'Task', render: (r) => <Two a={r.title} b={r.lead ? `Lead: ${r.lead.name}` : r.customer ? `Customer: ${r.customer.name}` : ''} /> }, { label: 'Assignee', render: (r) => nm(r.assignee) }, { label: 'Priority', render: (r) => <Badge>{r.priority}</Badge> }, { label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
        { label: 'Due', render: (r) => <span className={od(r) ? 'font-medium text-red-600' : ''}>{fmt(r.dueDate)}{od(r) && ' (overdue)'}</span> }, { label: 'Created by', render: (r) => nm(r.createdBy) }]}
      fields={[{ name: 'title', label: 'Title', required: true, full: true }, { name: 'description', label: 'Description', type: 'textarea' }, { name: 'assignee', label: 'Assign to', type: 'select', optionsKey: 'sales', required: true },
        { name: 'priority', label: 'Priority', type: 'select', options: PRIOS, default: 'Medium' }, { name: 'dueDate', label: 'Due date', type: 'date', required: true },
        { name: 'status', label: 'Status', type: 'select', options: o(['To Do', 'In Progress', 'Completed', 'Cancelled']), default: 'To Do', required: true },
        { name: 'lead', label: 'Linked lead', type: 'select', optionsKey: 'leads' }, { name: 'customer', label: 'Linked customer', type: 'select', optionsKey: 'customers' }]}
      actions={(r) => r.status !== 'Completed' && r.status !== 'Cancelled' && <button className="icon-btn hover:text-green-600" title="Mark complete" onClick={async () => { try { await api.put(`/tasks/${r._id}`, { status: 'Completed' }); toast('Task completed'); setTick((t) => t + 1); } catch (e) { toast(errMsg(e), 'error'); } }}><Check className="h-4 w-4" /></button>} />
  );
}

/* ---------------- Customers ---------------- */
function CustomerProfile({ id, onClose }) {
  const [d, setD] = useState(null);
  useEffect(() => { api.get(`/customers/${id}/profile`).then((r) => setD(r.data)).catch((e) => { toast(errMsg(e), 'error'); onClose(); }); }, [id]);
  const c = d?.customer;
  return (
    <Modal title="Customer profile" onClose={onClose} wide>
      {!d ? <Spinner /> : (
        <div className="space-y-5 text-sm">
          <div className="grid gap-3 sm:grid-cols-3">
            {[['Name', c.name], ['Phone', c.phone], ['Email', c.email || '—'], ['Address', c.address || '—'], ['Course', nm(c.course)], ['Owner', nm(c.owner)], ['Team', nm(c.team)], ['Created by', nm(c.createdBy)], ['Created', fmtDT(c.createdAt)]].map(([k, v]) => <div key={k} className={k === 'Address' ? 'sm:col-span-2' : ''}><p className="text-xs text-gray-400">{k}</p><p className="font-medium break-words">{v}</p></div>)}
            <div><p className="text-xs text-gray-400">Admission</p><Badge>{c.admissionStatus}</Badge></div>
          </div>
          {c.notes && <p className="rounded-lg bg-gray-50 p-3">{c.notes}</p>}
          <div><h4 className="mb-2 font-semibold">Admissions</h4>{d.admissions.length ? d.admissions.map((a) => <p key={a._id}>{nm(a.course)} — <Badge>{a.stage}</Badge> <Badge>{a.status}</Badge> {inr(a.fee)}</p>) : <p className="text-gray-400">None</p>}</div>
          <div><h4 className="mb-2 font-semibold">Invoices & payments</h4>{d.invoices.length ? d.invoices.map((i) => <p key={i._id}>{i.invoiceNo} — {inr(i.paid)} / {inr(i.total)} <Badge>{i.status}</Badge></p>) : <p className="text-gray-400">None</p>}</div>
          <div><h4 className="mb-2 font-semibold">Change history</h4>{c.history?.length ? <ul className="space-y-1 text-gray-600">{[...c.history].reverse().map((h, i) => <li key={i}>{fmtDT(h.at)} — {nm(h.by)}: {h.changes.map((x) => x.field === 'created' ? 'created record' : `${x.field}: ${x.from || '∅'} → ${x.to || '∅'}`).join('; ')}</li>)}</ul> : <p className="text-gray-400">None</p>}</div>
          <div><h4 className="mb-2 font-semibold">Activity</h4>{d.activity.length ? <ul className="space-y-1 text-gray-600">{d.activity.map((a) => <li key={a._id}>{fmtDT(a.createdAt)} — {a.summary} <span className="text-gray-400">({a.actorName})</span></li>)}</ul> : <p className="text-gray-400">None</p>}</div>
        </div>
      )}
    </Modal>
  );
}
export function CustomersPage() {
  const { user } = useAuth(); const [view, setView] = useState(null);
  const canDeleteCustomer = user.role === 'superadmin' || user.role === 'admin';
  return (
    <>
      <ResourcePage title={user.role === 'superadmin' ? 'All Customers' : user.role === 'sales' ? 'My Customers' : 'Customers'} subtitle="One shared customer directory — updated live across all roles" endpoint="/customers" events={[...EV.customer, ...EV.team, ...EV.adm]} newLabel="Add Customer" canCreate canEdit canDelete={canDeleteCustomer} onRowClick={(r) => setView(r._id)}
        filters={[{ key: 'course', label: 'Course', optionsKey: 'courses' }, { key: 'admissionStatus', label: 'Admission', options: o(['Not Started', 'In Progress', 'Admitted', 'Dropped']) }, { key: 'owner', label: 'Owner', optionsKey: 'owners', hidden: (u) => u.role === 'sales' }, { key: 'team', label: 'Team', optionsKey: 'teams', hidden: (u) => u.role !== 'superadmin' }]}
        columns={[{ label: 'Customer', render: (r) => <Two a={r.name} b={`${r.phone}${r.email ? ' · ' + r.email : ''}`} /> }, { label: 'Course', render: (r) => nm(r.course) }, { label: 'Owner', render: (r) => nm(r.owner) }, ...(user.role === 'superadmin' ? [{ label: 'Team', render: (r) => nm(r.team) }] : []), { label: 'Admission', render: (r) => <Badge>{r.admissionStatus}</Badge> }, { label: 'Added', render: (r) => fmt(r.createdAt) }]}
        fields={[{ name: 'name', label: 'Name', required: true }, { name: 'phone', label: 'Phone', type: 'tel', required: true }, { name: 'email', label: 'Email', type: 'email' }, { name: 'address', label: 'Address', type: 'text', placeholder: 'Enter complete address' }, { name: 'course', label: 'Course interest', type: 'select', optionsKey: 'courses' },
          { name: 'owner', label: 'Owner', type: 'select', optionsKey: 'owners', hidden: (v, e, u) => u.role === 'sales', hint: 'Defaults to you' }, { name: 'admissionStatus', label: 'Admission status', type: 'select', options: o(['Not Started', 'In Progress', 'Admitted', 'Dropped']), default: 'Not Started' }, { name: 'notes', label: 'Notes', type: 'textarea' }]}
        actions={(r) => <button className="icon-btn" title="Open profile" onClick={() => setView(r._id)}><Eye className="h-4 w-4" /></button>} />
      {view && <CustomerProfile id={view} onClose={() => setView(null)} />}
    </>
  );
}

/* ---------------- Courses & Admissions ---------------- */
export function AdmissionsPage() {
  const { user } = useAuth();
  const staff = user.role !== 'sales';
  const [tab, setTab] = useState('Admissions');
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-semibold">Courses & Admissions</h1><p className="text-sm text-gray-500">Track enrollment stages, fees and admission status</p></div>
      {tabs(['Admissions', 'Courses'], tab, setTab)}
      {tab === 'Admissions' ? (
        <ResourcePage embedded title="Admission" endpoint="/admissions" events={[...EV.adm, ...EV.customer, ...EV.team]} newLabel="New Admission" canCreate canEdit canDelete={staff} dateFilter={false}
          filters={[{ key: 'stage', label: 'Stage', options: o(['Enquiry', 'Counselling', 'Registered', 'Enrolled', 'Completed', 'Dropped']) }, { key: 'status', label: 'Status', options: o(['Pending', 'Confirmed', 'Cancelled']) }, { key: 'course', label: 'Course', optionsKey: 'courses' }]}
          columns={[{ label: 'Customer', render: (r) => <Two a={nm(r.customer)} b={r.customer?.phone} /> }, { label: 'Course', render: (r) => nm(r.course) }, { label: 'Stage', render: (r) => <Badge>{r.stage}</Badge> }, { label: 'Status', render: (r) => <Badge>{r.status}</Badge> }, { label: 'Admission date', render: (r) => fmt(r.admissionDate) }, { label: 'Fee', render: (r) => inr(r.fee) }, { label: 'Owner', render: (r) => nm(r.owner) }]}
          fields={[{ name: 'customer', label: 'Customer', type: 'select', optionsKey: 'customers', required: true, createOnly: true }, { name: 'course', label: 'Course', type: 'select', optionsKey: 'courses', required: true, createOnly: true }, { name: 'mode', label: 'Internship Mode', type: 'select', options: o(['Online', 'Offline']), default: 'Online' },
            { name: 'stage', label: 'Enrollment stage', type: 'select', options: o(['Enquiry', 'Counselling', 'Registered', 'Enrolled', 'Completed', 'Dropped']), default: 'Enquiry' }, { name: 'status', label: 'Admission status', type: 'select', options: o(['Pending', 'Confirmed', 'Cancelled']), default: 'Pending' },
            { name: 'admissionDate', label: 'Admission date', type: 'date' }, { name: 'fee', label: 'Fee amount (₹)', type: 'number' }]} />
      ) : (
        <ResourcePage embedded title="Course" endpoint="/courses" newLabel="Add Course" canCreate={staff} canEdit={staff} canDelete={staff} dateFilter={false}
          columns={[{ label: 'Course', key: 'name' }, { label: 'Fee', render: (r) => inr(r.fee) }, { label: 'Duration', render: (r) => r.duration || '—' }, { label: 'Status', render: (r) => <Badge>{r.active ? 'Active' : 'Inactive'}</Badge> }]}
          fields={[{ name: 'name', label: 'Course name', required: true }, { name: 'fee', label: 'Fee (₹)', type: 'number' }, { name: 'duration', label: 'Duration' }, { name: 'active', label: 'Status', type: 'select', bool: true, options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }] }, { name: 'description', label: 'Description', type: 'textarea' }]} />
      )}
    </div>
  );
}

/* ---------------- Invoices & Payments ---------------- */
export function InvoicesPage() {
  const { user } = useAuth();
  const staff = user.role !== 'sales';
  const [tab, setTab] = useState('Invoices');
  const [showNewInvoice, setShowNewInvoice] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [downloadingId, setDownloadingId] = useState(null);
  const nav = useNavigate();

  const handleDownloadPdf = async (e, invoiceId, invoiceNo) => {
    e.stopPropagation();
    if (downloadingId) return;
    setDownloadingId(invoiceId);
    try {
      const res = await api.get(`/invoices/${invoiceId}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(invoiceNo || 'invoice').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast('PDF downloaded');
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Invoices & Payments</h1>
        <p className="text-sm text-gray-500">
          Create invoices, manage installments, and track payments
        </p>
      </div>

      {tabs(['Invoices', 'Payments'], tab, setTab)}

      {tab === 'Invoices' ? (
        <>
          <ResourcePage
            embedded
            title="Invoice"
            endpoint="/invoices"
            events={[...EV.pay, ...EV.customer, ...EV.team]}
            canCreate={false}
            canEdit={false}
            canDelete={staff}
            refreshKey={refreshKey}
            headerActions={
              <button
                type="button"
                className="btn btn-primary flex items-center gap-1.5"
                onClick={() => setShowNewInvoice(true)}
              >
                <Plus className="h-4 w-4" /> New Invoice
              </button>
            }
            onRowClick={(r) => nav(`/invoices/${r._id}`)}
            filters={[
              { key: 'status', label: 'Status', options: o(['Pending', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled']) },
              { key: 'course', label: 'Course', optionsKey: 'courses' },
            ]}
            columns={[
              {
                label: 'Invoice No.',
                render: (r) => <span className="font-mono font-semibold text-teal-800">{r.invoiceNo}</span>,
              },
              {
                label: 'Customer / Student',
                render: (r) => (
                  <div>
                    <p className="font-medium text-gray-900">{r.customerName || nm(r.customer)}</p>
                    {r.customerPhone && <p className="text-xs text-gray-400">{r.customerPhone}</p>}
                  </div>
                ),
              },
              {
                label: 'Program / Course',
                render: (r) => r.programName || nm(r.course) || '—',
              },
              {
                label: 'Total Fee',
                render: (r) => <span className="font-semibold">{inr(r.total)}</span>,
              },
              {
                label: 'Paid',
                render: (r) => <span className="font-medium text-green-600">{inr(r.paid)}</span>,
              },
              {
                label: 'Balance',
                render: (r) => {
                  const b = (r.total || 0) - (r.paid || 0);
                  return <span className={`font-medium ${b > 0 ? 'text-coral-600' : 'text-gray-500'}`}>{inr(b)}</span>;
                },
              },
              {
                label: 'Email',
                render: (r) => (
                  <Badge tone={r.emailStatus === 'Sent' ? 'green' : r.emailStatus === 'Failed' ? 'red' : 'gray'}>
                    {r.emailStatus || 'Not Sent'}
                  </Badge>
                ),
              },
              {
                label: 'Status',
                render: (r) => (
                  <Badge tone={r.status === 'Paid' ? 'green' : r.status === 'Overdue' ? 'red' : 'amber'}>
                    {r.status}
                  </Badge>
                ),
              },
            ]}
            actions={(r) => (
              <div className="flex items-center gap-1">
                <button
                  className="icon-btn text-teal-600 hover:bg-teal-50"
                  title="View invoice details & preview"
                  onClick={(e) => {
                    e.stopPropagation();
                    nav(`/invoices/${r._id}`);
                  }}
                >
                  <Eye className="h-4 w-4" />
                </button>
                <button
                  className="icon-btn text-blue-600 hover:bg-blue-50"
                  title="Download PDF"
                  disabled={downloadingId === r._id}
                  onClick={(e) => handleDownloadPdf(e, r._id, r.invoiceNo)}
                >
                  {downloadingId === r._id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                </button>
              </div>
            )}
          />

          {showNewInvoice && (
            <NewInvoiceModal
              onClose={() => setShowNewInvoice(false)}
              onSuccess={() => setRefreshKey((k) => k + 1)}
            />
          )}
        </>
      ) : (
        <ResourcePage
          embedded
          title="Payment"
          endpoint="/payments"
          events={[...EV.pay, ...EV.team]}
          newLabel={staff ? 'Record Payment' : 'Log Payment Update'}
          canCreate
          canEdit={staff}
          canDelete={staff}
          filters={[
            { key: 'status', label: 'Status', options: o(['Pending', 'Success', 'Paid', 'Failed', 'Refunded']) },
            { key: 'method', label: 'Method', options: o(['UPI', 'Cash', 'Bank Transfer', 'Card', 'Other']) },
          ]}
          columns={[
            { label: 'Invoice', render: (r) => <span className="font-mono">{r.invoice?.invoiceNo || '—'}</span> },
            { label: 'Customer', render: (r) => nm(r.customer) },
            { label: 'Amount', render: (r) => inr(r.amount) },
            { label: 'Method', key: 'method' },
            { label: 'Description', render: (r) => r.description || '—' },
            { label: 'Txn Ref', render: (r) => r.txnRef || '—' },
            { label: 'Date', render: (r) => fmt(r.paymentDate) },
            { label: 'Status', render: (r) => <Badge tone={r.status === 'Success' || r.status === 'Paid' ? 'green' : 'amber'}>{r.status}</Badge> },
            { label: 'Recorded by', render: (r) => nm(r.recordedBy) },
          ]}
          fields={[
            { name: 'invoice', label: 'Invoice', type: 'select', optionsKey: 'invoices', required: true, createOnly: true },
            { name: 'amount', label: 'Amount (₹)', type: 'number', required: true },
            { name: 'method', label: 'Method', type: 'select', options: o(['UPI', 'Cash', 'Bank Transfer', 'Card', 'Other']), default: 'UPI' },
            { name: 'description', label: 'Description' },
            { name: 'emiNumber', label: 'EMI / Installment No.' },
            { name: 'txnRef', label: 'Transaction reference' },
            { name: 'paymentDate', label: 'Payment date', type: 'date' },
            { name: 'status', label: 'Status', type: 'select', options: o(['Pending', 'Success', 'Paid', 'Failed', 'Refunded']), default: 'Success', hidden: (v, e, u) => u.role === 'sales' },
          ]}
        />
      )}
    </div>
  );
}

/* ---------------- Activity ---------------- */
export function ActivityPage() {
  return (
    <ResourcePage title="Activity History" subtitle="Who did what, and when" endpoint="/activity" events={['activity:created']}
      filters={[{ key: 'entity', label: 'Type', options: o(['Lead', 'Task', 'Customer', 'Admission', 'Invoice', 'Payment', 'User', 'Team', 'Course']) }]}
      columns={[{ label: 'When', render: (r) => fmtDT(r.createdAt) }, { label: 'Actor', key: 'actorName' }, { label: 'Action', render: (r) => <Badge tone="gray">{r.action}</Badge> }, { label: 'Details', render: (r) => <div><p>{r.summary}</p>{r.changes?.length > 0 && <p className="text-xs text-gray-400">{r.changes.map((c) => `${c.field}: ${c.from || '∅'} → ${c.to || '∅'}`).join(' · ')}</p>}</div> }]} />
  );
}
