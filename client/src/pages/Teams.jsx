import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, UserPlus, ArrowRightLeft, UserMinus, History } from 'lucide-react';
import api, { errMsg } from '../api';
import { useAuth } from '../auth.jsx';
import { useLive, EV } from '../socket.jsx';
import { useLookups } from '../lookups.jsx';
import { Modal, Confirm, Spinner, Empty, Badge, fmtDT, toast, useCardSelection, LOGO_PALETTE } from '../ui.jsx';

const Pill = ({ l, v, t = '' }) => <div className="rounded-lg bg-gray-50 px-3 py-2 text-center"><p className={`text-lg font-semibold ${t}`}>{v}</p><p className="text-[11px] text-gray-500">{l}</p></div>;

export default function Teams() {
  const { user } = useAuth(); const lk = useLookups(); const isSuper = user.role === 'superadmin';
  const { selectedId, selectCard } = useCardSelection();
  const [teams, setTeams] = useState(null); const [m, setM] = useState(null); const [val, setVal] = useState(''); const [name, setName] = useState(''); const [busy, setBusy] = useState(false); const [hist, setHist] = useState({});
  const [allSales, setAllSales] = useState([]);
  const load = useCallback(async () => { try { setTeams((await api.get('/teams')).data); } catch (e) { toast(errMsg(e), 'error'); } }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (isSuper) api.get('/users', { params: { role: 'sales', limit: 100, active: 'true' } }).then((r) => setAllSales(r.data.items)); }, [isSuper, teams]);
  useLive([...EV.team, ...EV.lead, ...EV.task, 'user:updated'], load);

  const run = async (fn, msg) => { setBusy(true); try { await fn(); toast(msg); setM(null); load(); lk.reload?.(); } catch (e) { toast(errMsg(e), 'error'); } finally { setBusy(false); } };
  const open = (type, team, member) => { setM({ type, team, member }); setVal(type === 'edit' ? team.admin?._id || '' : ''); setName(type === 'edit' ? team.name : ''); };

  if (!teams) return <Spinner />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-xl font-semibold">{isSuper ? 'Team Management' : 'My Team'}</h1><p className="text-sm text-gray-500">{isSuper ? 'Create teams, assign Admins and manage Sales Executives' : 'Monitor your team’s workload and performance'}</p></div>
        {isSuper && <button className="btn btn-primary" onClick={() => open('create')}><Plus className="h-4 w-4" />New Team</button>}
      </div>
      {!teams.length && <div className="card"><Empty text={isSuper ? 'No teams yet. Create one to get started.' : 'You are not assigned to a team yet. Contact the Super Admin.'} /></div>}
      {teams.map((t, idx) => {
        const cardColor = idx % 2 === 0 ? LOGO_PALETTE.teal : LOGO_PALETTE.coral;
        const isSelected = selectedId === t._id;
        return (
          <div
            key={t._id}
            onClick={(e) => {
              if (e.target.closest('button, a, input, select, textarea')) return;
              selectCard(t._id);
            }}
            className="card transition-all duration-300 cursor-pointer hover:shadow-sm"
            style={{
              borderTop: isSelected ? `4.5px solid ${cardColor}` : `4px solid ${cardColor}`,
              boxShadow: isSelected ? `0 4px 14px -2px ${cardColor}33` : undefined,
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-4">
              <div><h2 className="font-semibold transition-colors duration-300" style={{ color: isSelected ? cardColor : undefined }}>{t.name}</h2><p className="text-sm text-gray-500">Admin: <b className="text-gray-800">{t.admin?.name || 'Not assigned'}</b></p></div>
              {isSuper && <div className="flex flex-wrap gap-2"><button className="btn btn-ghost" onClick={() => open('edit', t)}><Pencil className="h-4 w-4" />Edit / Change Admin</button><button className="btn btn-primary" onClick={() => open('add', t)}><UserPlus className="h-4 w-4" />Add member</button></div>}
            </div>
          <div className="grid grid-cols-3 gap-2 p-4 sm:grid-cols-4 lg:grid-cols-7">
            <Pill l="Members" v={t.members.length} /><Pill l="Leads" v={t.stats.leads} /><Pill l="Converted" v={t.stats.converted} t="text-green-600" /><Pill l="Unassigned" v={t.stats.unassigned} />
            <Pill l="Open tasks" v={t.stats.open} /><Pill l="Overdue" v={t.stats.overdue} t="text-red-600" /><Pill l="Admissions" v={t.stats.admissions} />
          </div>
          <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            <table className="w-full min-w-[620px] sm:min-w-full"><thead className="bg-gray-50"><tr>{['Member', 'Status', 'Leads', 'Converted', 'Rate', 'Open tasks', 'Overdue', ...(isSuper ? ['Actions'] : [])].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-100">
                {t.members.map((x) => (
                  <tr key={x._id}><td className="td"><p className="font-medium">{x.name}</p><p className="text-xs text-gray-400">{x.email}</p></td><td className="td"><Badge>{x.active ? 'Active' : 'Inactive'}</Badge></td>
                    <td className="td">{x.stats.leads}</td><td className="td">{x.stats.converted}</td><td className="td">{x.stats.rate}%</td><td className="td">{x.stats.open}</td><td className="td text-red-600">{x.stats.overdue}</td>
                    {isSuper && <td className="td"><div className="flex gap-1"><button className="icon-btn" title="Transfer" onClick={() => open('transfer', t, x)}><ArrowRightLeft className="h-4 w-4" /></button><button className="icon-btn hover:text-red-600" title="Remove from team" onClick={() => open('remove', t, x)}><UserMinus className="h-4 w-4" /></button></div></td>}
                  </tr>
                ))}
                {!t.members.length && <tr><td colSpan={8}><Empty text="No members in this team" /></td></tr>}
              </tbody></table>
          </div>
          {t.history?.length > 0 && (
            <div className="border-t border-gray-100 p-3">
              <button className="flex items-center gap-1 text-xs text-gray-500" onClick={() => setHist({ ...hist, [t._id]: !hist[t._id] })}><History className="h-3.5 w-3.5" />Membership history</button>
              {hist[t._id] && <ul className="mt-2 space-y-1 text-xs text-gray-600">{t.history.map((h, i) => <li key={i}>{fmtDT(h.at)} — <b>{h.user?.name}</b>: {h.from?.name || 'No team'} → {h.to?.name || 'No team'}</li>)}</ul>}
            </div>
          )}
          </div>
        );
      })}

      {m && ['create', 'edit'].includes(m.type) && (
        <Modal title={m.type === 'create' ? 'New Team' : 'Edit Team'} onClose={() => setM(null)}>
          <div className="space-y-4">
            <div><label className="label">Team name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><label className="label">Team Admin</label><select className="input" value={val} onChange={(e) => setVal(e.target.value)}><option value="">— None —</option>{lk.options('admins').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select><p className="mt-1 text-xs text-gray-400">Choosing an Admin who is in another team moves them here; the previous Admin of this team is unassigned.</p></div>
            <div className="flex justify-end gap-2"><button className="btn btn-ghost" onClick={() => setM(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={busy || !name.trim()} onClick={() => run(() => m.type === 'create' ? api.post('/teams', { name, adminId: val || undefined }) : api.put(`/teams/${m.team._id}`, { name, adminId: val || null }), 'Team saved')}>Save</button></div>
          </div>
        </Modal>
      )}
      {m?.type === 'add' && (
        <Modal title={`Add member to ${m.team.name}`} onClose={() => setM(null)}>
          <label className="label">Sales Executive</label>
          <select className="input" value={val} onChange={(e) => setVal(e.target.value)}><option value="">Select…</option>{allSales.filter((u) => u.team?._id !== m.team._id).map((u) => <option key={u._id} value={u._id}>{u.name}{u.team ? ` (currently ${u.team.name} — will transfer)` : ''}</option>)}</select>
          <div className="mt-5 flex justify-end gap-2"><button className="btn btn-ghost" onClick={() => setM(null)}>Cancel</button><button className="btn btn-primary" disabled={!val || busy} onClick={() => run(() => api.post(`/teams/${m.team._id}/members`, { userId: val }), 'Member added')}>Add</button></div>
        </Modal>
      )}
      {m?.type === 'transfer' && (
        <Modal title={`Transfer ${m.member.name}`} onClose={() => setM(null)}>
          <label className="label">Move to team</label>
          <select className="input" value={val} onChange={(e) => setVal(e.target.value)}><option value="">Select…</option>{teams.filter((t) => t._id !== m.team._id).map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}</select>
          <p className="mt-2 text-xs text-gray-400">Their leads, tasks and customers move with them. History is preserved.</p>
          <div className="mt-5 flex justify-end gap-2"><button className="btn btn-ghost" onClick={() => setM(null)}>Cancel</button><button className="btn btn-primary" disabled={!val || busy} onClick={() => run(() => api.post('/teams/transfer', { userId: m.member._id, toTeamId: val }), 'Member transferred')}>Transfer</button></div>
        </Modal>
      )}
      {m?.type === 'remove' && <Confirm title="Remove from team" text={`Remove ${m.member.name} from ${m.team.name}? Their login account and records are kept.`} busy={busy} onClose={() => setM(null)} onYes={() => run(() => api.delete(`/teams/${m.team._id}/members/${m.member._id}`), 'Member removed')} />}
    </div>
  );
}
