import { useEffect, useState } from 'react';
import { Eye, EyeOff, UserPlus, PhoneCall, UserCheck, Ban, CheckCircle2, KeyRound, Check, FileDown } from 'lucide-react';
import api, { errMsg } from '../api';
import { useAuth } from '../auth.jsx';
import { useLookups } from '../lookups.jsx';
import { EV } from '../socket.jsx';
import ResourcePage from '../ResourcePage.jsx';
import { Badge, Modal, Spinner, fmt, fmtDT, inr, roleLabel, toast, LEAD_STATUS_LIST } from '../ui.jsx';
import { downloadAccountsPdf } from '../exportPdf.js';

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
            {[['Lead ID', l.leadId], ['Name', l.name], ['Phone', l.phone], ['Email', l.email || '—'], ['Course', nm(l.course)], ['Source', l.source], ['Team', nm(l.team)], ['Admin', nm(l.admin)], ['Assigned to', nm(l.assignedTo)], ['Priority', l.priority], ['Next follow-up', fmt(l.nextFollowUp)], ['Created by', nm(l.createdBy)], ['Created', fmtDT(l.createdAt)], ['Updated', fmtDT(l.updatedAt)]].map(([k, v]) => <div key={k}><p className="text-xs text-gray-400">{k}</p><p className="font-medium">{v}</p></div>)}
            <div><p className="text-xs text-gray-400">Status</p><Badge>{l.status}</Badge></div>
          </div>
          {l.notes && <div><p className="text-xs text-gray-400">Notes</p><p>{l.notes}</p></div>}
          <div><h4 className="mb-2 font-semibold">Assignment history</h4>{l.history?.length ? <ul className="space-y-1 text-gray-600">{[...l.history].reverse().map((h, i) => <li key={i}>{fmtDT(h.at)} — {h.type}{h.from ? ` from ${nm(h.from)}` : ''}{h.to ? ` to ${nm(h.to)}` : ''} <span className="text-gray-400">by {nm(h.by)}</span></li>)}</ul> : <p className="text-gray-400">None</p>}</div>
          <div><h4 className="mb-2 font-semibold">Follow-up activity</h4>{l.followUps?.length ? <ul className="space-y-1 text-gray-600">{[...l.followUps].reverse().map((h, i) => <li key={i}>{fmtDT(h.date)} — {h.note} <span className="text-gray-400">by {nm(h.by)}</span></li>)}</ul> : <p className="text-gray-400">No follow-ups logged</p>}</div>
        </div>
      )}
    </Modal>
  );
}
export function LeadsPage({ mode }) {
  const { user } = useAuth(); const lk = useLookups(); const staff = user.role !== 'sales'; const fu = mode === 'followups';
  const [view, setView] = useState(null); const [assign, setAssign] = useState(null); const [follow, setFollow] = useState(null); const [val, setVal] = useState(''); const [fd, setFd] = useState({ note: '', next: '', status: '' }); const [tick, setTick] = useState(0);
  const act = async (fn, msg, close) => { try { await fn(); toast(msg); close(); setTick((t) => t + 1); } catch (e) { toast(errMsg(e), 'error'); } };
  return (
    <>
      <ResourcePage title={fu ? 'Follow-ups' : user.role === 'sales' ? 'My Leads' : 'Lead Management'} subtitle={fu ? 'Leads with a follow-up due today or overdue' : 'Create, assign and track leads in real time'} endpoint="/leads" params={fu ? { followUp: 'due' } : {}} refreshKey={tick} events={[...EV.lead, ...EV.team]} newLabel="New Lead"
        canCreate={staff && !fu} canEdit canDelete={staff && !fu} onRowClick={(r) => setView(r._id)}
        filters={[{ key: 'status', label: 'Status', options: o(LEAD_STATUS_LIST) }, { key: 'priority', label: 'Priority', options: PRIOS }, { key: 'source', label: 'Source', options: SOURCES }, { key: 'course', label: 'Course', optionsKey: 'courses' },
          { key: 'assignedTo', label: 'Owner', optionsKey: 'sales', hidden: (u) => u.role === 'sales' }, { key: 'team', label: 'Team', optionsKey: 'teams', hidden: (u) => u.role !== 'superadmin' }]}
        columns={[{ label: 'Lead', render: (r) => <Two a={r.name} b={`${r.leadId} · ${r.phone}`} /> }, { label: 'Course', render: (r) => nm(r.course) }, { label: 'Source', key: 'source' }, { label: 'Status', render: (r) => <Badge>{r.status}</Badge> }, { label: 'Priority', render: (r) => <Badge>{r.priority}</Badge> },
          { label: 'Assigned to', render: (r) => r.assignedTo?.name || <Badge tone="orange">Unassigned</Badge> }, ...(user.role === 'superadmin' ? [{ label: 'Team', render: (r) => nm(r.team) }] : []), { label: 'Follow-up', render: (r) => <span className={r.nextFollowUp && new Date(r.nextFollowUp) < new Date() && !['Converted', 'Lost'].includes(r.status) ? 'font-medium text-red-600' : ''}>{fmt(r.nextFollowUp)}</span> }]}
        fields={[{ name: 'name', label: 'Student / customer name', required: true }, { name: 'phone', label: 'Phone', type: 'tel', required: true }, { name: 'email', label: 'Email', type: 'email' },
          { name: 'course', label: 'Interested course', type: 'select', optionsKey: 'courses' }, { name: 'source', label: 'Lead source', type: 'select', options: SOURCES, default: 'Direct' }, { name: 'priority', label: 'Priority', type: 'select', options: PRIOS, default: 'Medium' },
          { name: 'status', label: 'Status', type: 'select', options: o(LEAD_STATUS_LIST), default: 'New' }, { name: 'nextFollowUp', label: 'Next follow-up', type: 'date' },
          { name: 'assignedTo', label: 'Assign to Sales Executive', type: 'select', optionsKey: 'sales', createOnly: true },
          { name: 'team', label: 'Assigned team', type: 'select', optionsKey: 'teams', createOnly: true, hidden: (v, e, u) => u.role !== 'superadmin' || !!v.assignedTo, hint: 'Used when no Sales Executive is selected' },
          { name: 'notes', label: 'Notes', type: 'textarea' }]}
        actions={(r) => (
          <>
            <button className="icon-btn" title="View" onClick={() => setView(r._id)}><Eye className="h-4 w-4" /></button>
            {staff && <button className="icon-btn" title="Assign / reassign" onClick={() => { setAssign(r); setVal(r.assignedTo?._id || ''); }}><UserPlus className="h-4 w-4" /></button>}
            <button className="icon-btn" title="Record follow-up" onClick={() => { setFollow(r); setFd({ note: '', next: '', status: '' }); }}><PhoneCall className="h-4 w-4" /></button>
            {r.status !== 'Converted' && !r.customer && <button className="icon-btn hover:text-green-600" title="Convert to customer" onClick={() => act(() => api.post(`/leads/${r._id}/convert`), 'Converted to customer', () => {})}><UserCheck className="h-4 w-4" /></button>}
          </>
        )} />
      {view && <LeadDetail id={view} onClose={() => setView(null)} />}
      {assign && (
        <Modal title={`Assign — ${assign.name}`} onClose={() => setAssign(null)}>
          <label className="label">Sales Executive</label>
          <select className="input" value={val} onChange={(e) => setVal(e.target.value)}><option value="">Select…</option>{lk.options('sales').map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select>
          <div className="mt-5 flex justify-end gap-2"><button className="btn btn-ghost" onClick={() => setAssign(null)}>Cancel</button><button className="btn btn-primary" disabled={!val} onClick={() => act(() => api.post(`/leads/${assign._id}/assign`, { assignedTo: val }), 'Lead assigned', () => setAssign(null))}>Assign</button></div>
        </Modal>
      )}
      {follow && (
        <Modal title={`Follow-up — ${follow.name}`} onClose={() => setFollow(null)}>
          <div className="space-y-4">
            <div><label className="label">What happened? *</label><textarea className="input" rows={3} value={fd.note} onChange={(e) => setFd({ ...fd, note: e.target.value })} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="label">Next follow-up date</label><input type="date" className="input" value={fd.next} onChange={(e) => setFd({ ...fd, next: e.target.value })} /></div>
              <div><label className="label">Update status</label><select className="input" value={fd.status} onChange={(e) => setFd({ ...fd, status: e.target.value })}><option value="">Keep ({follow.status})</option>{LEAD_STATUS_LIST.map((s) => <option key={s}>{s}</option>)}</select></div>
            </div>
            <div className="flex justify-end gap-2"><button className="btn btn-ghost" onClick={() => setFollow(null)}>Cancel</button><button className="btn btn-primary" disabled={!fd.note.trim()} onClick={() => act(() => api.post(`/leads/${follow._id}/followup`, fd), 'Follow-up saved', () => setFollow(null))}>Save</button></div>
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
    <ResourcePage title={user.role === 'sales' ? 'My Tasks' : 'Task Management'} subtitle="Assign and track work for Sales Executives" endpoint="/tasks" refreshKey={tick} events={[...EV.task, ...EV.team]} newLabel="New Task" canCreate={staff} canEdit canDelete={staff}
      filters={[{ key: 'status', label: 'Status', options: o(['To Do', 'In Progress', 'Completed', 'Cancelled']) }, { key: 'priority', label: 'Priority', options: PRIOS }, { key: 'overdue', label: 'Due', options: [{ value: '1', label: 'Overdue only' }] }, { key: 'assignee', label: 'Assignee', optionsKey: 'sales', hidden: (u) => u.role === 'sales' }]}
      columns={[{ label: 'Task', render: (r) => <Two a={r.title} b={r.lead ? `Lead: ${r.lead.name}` : r.customer ? `Customer: ${r.customer.name}` : ''} /> }, { label: 'Assignee', render: (r) => nm(r.assignee) }, { label: 'Priority', render: (r) => <Badge>{r.priority}</Badge> }, { label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
        { label: 'Due', render: (r) => <span className={od(r) ? 'font-medium text-red-600' : ''}>{fmt(r.dueDate)}{od(r) && ' (overdue)'}</span> }, { label: 'Created by', render: (r) => nm(r.createdBy) }]}
      fields={[{ name: 'title', label: 'Title', required: true, full: true, readOnlyFor: 'sales' }, { name: 'description', label: 'Description', type: 'textarea', readOnlyFor: 'sales' }, { name: 'assignee', label: 'Assign to', type: 'select', optionsKey: 'sales', required: true, readOnlyFor: 'sales' },
        { name: 'priority', label: 'Priority', type: 'select', options: PRIOS, default: 'Medium', readOnlyFor: 'sales' }, { name: 'dueDate', label: 'Due date', type: 'date', required: true, readOnlyFor: 'sales' },
        { name: 'status', label: 'Status', type: 'select', options: o(['To Do', 'In Progress', 'Completed', 'Cancelled']), default: 'To Do', required: true },
        { name: 'lead', label: 'Linked lead', type: 'select', optionsKey: 'leads', readOnlyFor: 'sales' }, { name: 'customer', label: 'Linked customer', type: 'select', optionsKey: 'customers', readOnlyFor: 'sales' }]}
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
            {[['Name', c.name], ['Phone', c.phone], ['Email', c.email || '—'], ['Course', nm(c.course)], ['Owner', nm(c.owner)], ['Team', nm(c.team)], ['Created by', nm(c.createdBy)], ['Created', fmtDT(c.createdAt)]].map(([k, v]) => <div key={k}><p className="text-xs text-gray-400">{k}</p><p className="font-medium">{v}</p></div>)}
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
  return (
    <>
      <ResourcePage title={user.role === 'superadmin' ? 'All Customers' : user.role === 'sales' ? 'My Customers' : 'Customers'} subtitle="One shared customer directory — updated live across all roles" endpoint="/customers" events={[...EV.customer, ...EV.team, ...EV.adm]} newLabel="Add Customer" canCreate canEdit canDelete={user.role === 'superadmin'} onRowClick={(r) => setView(r._id)}
        filters={[{ key: 'course', label: 'Course', optionsKey: 'courses' }, { key: 'admissionStatus', label: 'Admission', options: o(['Not Started', 'In Progress', 'Admitted', 'Dropped']) }, { key: 'owner', label: 'Owner', optionsKey: 'owners', hidden: (u) => u.role === 'sales' }, { key: 'team', label: 'Team', optionsKey: 'teams', hidden: (u) => u.role !== 'superadmin' }]}
        columns={[{ label: 'Customer', render: (r) => <Two a={r.name} b={`${r.phone}${r.email ? ' · ' + r.email : ''}`} /> }, { label: 'Course', render: (r) => nm(r.course) }, { label: 'Owner', render: (r) => nm(r.owner) }, ...(user.role === 'superadmin' ? [{ label: 'Team', render: (r) => nm(r.team) }] : []), { label: 'Admission', render: (r) => <Badge>{r.admissionStatus}</Badge> }, { label: 'Added', render: (r) => fmt(r.createdAt) }]}
        fields={[{ name: 'name', label: 'Name', required: true }, { name: 'phone', label: 'Phone', type: 'tel', required: true }, { name: 'email', label: 'Email', type: 'email' }, { name: 'course', label: 'Course interest', type: 'select', optionsKey: 'courses' },
          { name: 'owner', label: 'Owner', type: 'select', optionsKey: 'owners', hidden: (v, e, u) => u.role === 'sales', hint: 'Defaults to you' }, { name: 'admissionStatus', label: 'Admission status', type: 'select', options: o(['Not Started', 'In Progress', 'Admitted', 'Dropped']), default: 'Not Started' }, { name: 'notes', label: 'Notes', type: 'textarea' }]}
        actions={(r) => <button className="icon-btn" title="Open profile" onClick={() => setView(r._id)}><Eye className="h-4 w-4" /></button>} />
      {view && <CustomerProfile id={view} onClose={() => setView(null)} />}
    </>
  );
}

/* ---------------- Courses & Admissions ---------------- */
export function AdmissionsPage() {
  const { user } = useAuth(); const [tab, setTab] = useState('Admissions');
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-semibold">Courses & Admissions</h1><p className="text-sm text-gray-500">Track enrollment stages, fees and admission status</p></div>
      {tabs(['Admissions', 'Courses'], tab, setTab)}
      {tab === 'Admissions' ? (
        <ResourcePage embedded title="Admission" endpoint="/admissions" events={[...EV.adm, ...EV.customer, ...EV.team]} newLabel="New Admission" canCreate canEdit canDelete={user.role !== 'sales'} dateFilter={false}
          filters={[{ key: 'stage', label: 'Stage', options: o(['Enquiry', 'Counselling', 'Registered', 'Enrolled', 'Completed', 'Dropped']) }, { key: 'status', label: 'Status', options: o(['Pending', 'Confirmed', 'Cancelled']) }, { key: 'course', label: 'Course', optionsKey: 'courses' }]}
          columns={[{ label: 'Customer', render: (r) => <Two a={nm(r.customer)} b={r.customer?.phone} /> }, { label: 'Course', render: (r) => nm(r.course) }, { label: 'Stage', render: (r) => <Badge>{r.stage}</Badge> }, { label: 'Status', render: (r) => <Badge>{r.status}</Badge> }, { label: 'Admission date', render: (r) => fmt(r.admissionDate) }, { label: 'Fee', render: (r) => inr(r.fee) }, { label: 'Owner', render: (r) => nm(r.owner) }]}
          fields={[{ name: 'customer', label: 'Customer', type: 'select', optionsKey: 'customers', required: true, createOnly: true }, { name: 'course', label: 'Course', type: 'select', optionsKey: 'courses', required: true, createOnly: true },
            { name: 'stage', label: 'Enrollment stage', type: 'select', options: o(['Enquiry', 'Counselling', 'Registered', 'Enrolled', 'Completed', 'Dropped']), default: 'Enquiry' }, { name: 'status', label: 'Admission status', type: 'select', options: o(['Pending', 'Confirmed', 'Cancelled']), default: 'Pending' },
            { name: 'admissionDate', label: 'Admission date', type: 'date' }, { name: 'fee', label: 'Fee amount (₹)', type: 'number' }]} />
      ) : (
        <ResourcePage embedded title="Course" endpoint="/courses" newLabel="Add Course" canCreate={user.role === 'superadmin'} canEdit={user.role === 'superadmin'} canDelete={user.role === 'superadmin'} dateFilter={false}
          columns={[{ label: 'Course', key: 'name' }, { label: 'Fee', render: (r) => inr(r.fee) }, { label: 'Duration', render: (r) => r.duration || '—' }, { label: 'Status', render: (r) => <Badge>{r.active ? 'Active' : 'Inactive'}</Badge> }]}
          fields={[{ name: 'name', label: 'Course name', required: true }, { name: 'fee', label: 'Fee (₹)', type: 'number' }, { name: 'duration', label: 'Duration' }, { name: 'active', label: 'Status', type: 'select', bool: true, options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }] }, { name: 'description', label: 'Description', type: 'textarea' }]} />
      )}
    </div>
  );
}

/* ---------------- Invoices & Payments ---------------- */
export function InvoicesPage() {
  const { user } = useAuth(); const staff = user.role !== 'sales'; const [tab, setTab] = useState('Invoices');
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-semibold">{staff ? 'Invoices & Payments' : 'Payment Updates'}</h1><p className="text-sm text-gray-500">{staff ? 'Create invoices and verify payments' : 'Log payment updates; an Admin verifies them before they count as paid'}</p></div>
      {tabs(['Invoices', 'Payments'], tab, setTab)}
      {tab === 'Invoices' ? (
        <ResourcePage embedded title="Invoice" endpoint="/invoices" events={[...EV.pay, ...EV.customer, ...EV.team]} newLabel="New Invoice" canCreate={staff} canEdit={staff} canDelete={user.role === 'superadmin'}
          filters={[{ key: 'status', label: 'Status', options: o(['Pending', 'Partially Paid', 'Paid', 'Failed', 'Refunded']) }, { key: 'course', label: 'Course', optionsKey: 'courses' }]}
          columns={[{ label: 'Invoice', key: 'invoiceNo' }, { label: 'Customer', render: (r) => nm(r.customer) }, { label: 'Course', render: (r) => nm(r.course) }, { label: 'Total', render: (r) => inr(r.total) }, { label: 'Paid', render: (r) => inr(r.paid) }, { label: 'Balance', render: (r) => inr(r.total - r.paid) }, { label: 'Status', render: (r) => <Badge>{r.status}</Badge> }, { label: 'Last payment', render: (r) => r.paymentDate ? `${fmt(r.paymentDate)} · ${r.method || ''}` : '—' }]}
          fields={[{ name: 'customer', label: 'Customer', type: 'select', optionsKey: 'customers', required: true, createOnly: true }, { name: 'course', label: 'Course', type: 'select', optionsKey: 'courses' }, { name: 'total', label: 'Total fee (₹)', type: 'number', required: true }, { name: 'dueDate', label: 'Due date', type: 'date' }]} />
      ) : (
        <ResourcePage embedded title="Payment" endpoint="/payments" events={[...EV.pay, ...EV.team]} newLabel={staff ? 'Record Payment' : 'Log Payment Update'} canCreate canEdit={staff}
          filters={[{ key: 'status', label: 'Status', options: o(['Pending', 'Success', 'Failed', 'Refunded']) }, { key: 'method', label: 'Method', options: o(['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque', 'Online']) }]}
          columns={[{ label: 'Invoice', render: (r) => r.invoice?.invoiceNo || '—' }, { label: 'Customer', render: (r) => nm(r.customer) }, { label: 'Amount', render: (r) => inr(r.amount) }, { label: 'Method', key: 'method' }, { label: 'Txn ref', render: (r) => r.txnRef || '—' }, { label: 'Date', render: (r) => fmt(r.paymentDate) }, { label: 'Status', render: (r) => <Badge>{r.status}</Badge> }, { label: 'Recorded by', render: (r) => nm(r.recordedBy) }]}
          fields={[{ name: 'invoice', label: 'Invoice', type: 'select', optionsKey: 'invoices', required: true, createOnly: true }, { name: 'amount', label: 'Amount (₹)', type: 'number', required: true }, { name: 'method', label: 'Method', type: 'select', options: o(['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque', 'Online']), default: 'Cash' },
            { name: 'txnRef', label: 'Transaction reference' }, { name: 'paymentDate', label: 'Payment date', type: 'date' },
            { name: 'status', label: 'Status', type: 'select', options: o(['Pending', 'Success', 'Failed', 'Refunded']), default: 'Success', hidden: (v, e, u) => u.role === 'sales' }]} />
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
