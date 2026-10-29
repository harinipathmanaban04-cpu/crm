import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Target, Sparkles, UserCheck, UserX, Trophy, Contact, Users, ListChecks, AlarmClock, GraduationCap, Receipt, CalendarClock, XCircle, CheckCircle2, Wallet, TrendingUp, BarChart3, History } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';
import api, { errMsg } from '../api';
import { useAuth } from '../auth.jsx';
import { useLive, ALL_EVENTS } from '../socket.jsx';
import { useLookups } from '../lookups.jsx';
import { Stat, Card, Spinner, Badge, fmtDT, inr, toast, Empty, LOGO_PALETTE, LEAD_STATUS_LIST } from '../ui.jsx';

const COLORS = [LOGO_PALETTE.teal, LOGO_PALETTE.coral, LOGO_PALETTE.green, LOGO_PALETTE.cyan, LOGO_PALETTE.slate];

export default function Dashboard() {
  const { user } = useAuth(); const lk = useLookups(); const isSuper = user.role === 'superadmin'; const isSales = user.role === 'sales';
  const [f, setF] = useState({}); const [d, setD] = useState(null);
  const load = useCallback(async () => { try { const p = {}; Object.entries(f).forEach(([k, v]) => v && (p[k] = v)); setD((await api.get('/dashboard', { params: p })).data); } catch (e) { toast(errMsg(e), 'error'); } }, [JSON.stringify(f)]);
  useEffect(() => { load(); }, [load]);
  useLive(ALL_EVENTS, load);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  if (!d) return <Spinner />;
  const s = d.stats, c = d.charts;
  const cards = [
    ['Total leads', s.totalLeads, Target, 'bg-brand-100 text-brand-600'], ['New leads', s.newLeads, Sparkles, 'bg-blue-100 text-blue-700'], ['Assigned', s.assigned, UserCheck, 'bg-indigo-100 text-indigo-700'],
    ...(!isSales ? [['Unassigned', s.unassigned, UserX, 'bg-coral-100 text-coral-600']] : []),
    ['Converted', s.converted, Trophy, 'bg-green-100 text-green-700'], ['Lost', s.lost, XCircle, 'bg-red-100 text-red-700'], ['Follow-ups due', s.dueToday, CalendarClock, 'bg-amber-100 text-amber-800'],
    ['Customers', s.customers, Contact, 'bg-brand-100 text-brand-600'],
    ...(isSuper ? [['Active Admins', s.activeAdmins, Users, 'bg-violet-100 text-violet-700']] : []),
    ...(!isSales ? [[isSuper ? 'Active Sales Execs' : 'Team members', s.activeSales, Users, 'bg-violet-100 text-violet-700']] : []),
    ['Pending tasks', s.pending, ListChecks, 'bg-gray-100 text-gray-700'], ['Overdue tasks', s.overdue, AlarmClock, 'bg-red-100 text-red-700'], ['Completed tasks', s.completed, CheckCircle2, 'bg-green-100 text-green-700'],
    ['Course admissions', `${s.confirmed}/${s.admissions}`, GraduationCap, 'bg-brand-100 text-brand-600', 'confirmed / total'],
    ['Paid invoices', s.paidInv, Receipt, 'bg-green-100 text-green-700'], ['Unpaid invoices', s.unpaidInv, Receipt, 'bg-coral-100 text-coral-600'],
    ['Collected', inr(s.collected), Wallet, 'bg-green-100 text-green-700', `of ${inr(s.billed)} billed`],
  ];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-xl font-semibold">Welcome back, {user.name.split(' ')[0]} 👋</h1><p className="text-sm text-gray-500">{isSuper ? 'Company-wide' : isSales ? 'Your' : 'Team'} live overview</p></div>
        {!isSales && (
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {isSuper && <select className="input flex-1 sm:flex-none sm:w-auto text-xs sm:text-sm" value={f.team || ''} onChange={set('team')}><option value="">All teams</option>{lk.options('teams').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>}
            {isSuper && <select className="input flex-1 sm:flex-none sm:w-auto text-xs sm:text-sm" value={f.admin || ''} onChange={set('admin')}><option value="">All Admins</option>{lk.options('admins').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>}
            <select className="input flex-1 sm:flex-none sm:w-auto text-xs sm:text-sm" value={f.executive || ''} onChange={set('executive')}><option value="">All Sales Execs</option>{lk.options('sales').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
            <select className="input flex-1 sm:flex-none sm:w-auto text-xs sm:text-sm" value={f.course || ''} onChange={set('course')}><option value="">All courses</option>{lk.options('courses').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
            <select className="input flex-1 sm:flex-none sm:w-auto text-xs sm:text-sm" value={f.status || ''} onChange={set('status')}><option value="">All statuses</option>{LEAD_STATUS_LIST.map((x) => <option key={x}>{x}</option>)}</select>
            <input type="date" className="input flex-1 sm:flex-none sm:w-auto text-xs sm:text-sm" value={f.from || ''} onChange={set('from')} /><input type="date" className="input flex-1 sm:flex-none sm:w-auto text-xs sm:text-sm" value={f.to || ''} onChange={set('to')} />
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 xl:grid-cols-4">{cards.map(([l, v, I, t, sub], idx) => <Stat key={l} label={l} value={v} icon={I} index={idx} sub={sub} />)}</div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Leads (last 14 days)" icon={TrendingUp} color={LOGO_PALETTE.teal}><ResponsiveContainer width="100%" height={250}><LineChart data={c.leadsOverTime}><CartesianGrid strokeDasharray="3 3" stroke="#eee" /><XAxis dataKey="day" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} /><Tooltip /><Legend /><Line type="monotone" dataKey="leads" stroke={LOGO_PALETTE.teal} strokeWidth={2} dot={false} /><Line type="monotone" dataKey="converted" stroke={LOGO_PALETTE.coral} strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></Card>
        <Card title="Lead status (conversion funnel)" icon={BarChart3} color={LOGO_PALETTE.coral}><ResponsiveContainer width="100%" height={360}><BarChart data={c.leadStatus} layout="vertical" margin={{ left: 15, right: 20 }}><CartesianGrid strokeDasharray="3 3" stroke="#eee" /><XAxis type="number" allowDecimals={false} fontSize={11} /><YAxis type="category" dataKey="name" fontSize={11} width={140} tick={{ fill: '#4B5563' }} /><Tooltip /><Bar dataKey="value" fill={LOGO_PALETTE.coral} radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></Card>
        {!isSales && <Card title={isSuper ? 'Team performance' : 'Sales Executive performance'} icon={Trophy} color={LOGO_PALETTE.teal}>{c.performance.length ? <ResponsiveContainer width="100%" height={250}><BarChart data={c.performance}><CartesianGrid strokeDasharray="3 3" stroke="#eee" /><XAxis dataKey="name" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} /><Tooltip /><Legend /><Bar dataKey="leads" fill={LOGO_PALETTE.teal} radius={[4, 4, 0, 0]} /><Bar dataKey="converted" fill={LOGO_PALETTE.coral} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer> : <Empty text="No data yet" />}</Card>}
        <Card title="Task status" icon={ListChecks} color={LOGO_PALETTE.coral}>{c.taskStatus.length ? <ResponsiveContainer width="100%" height={250}><PieChart><Pie data={c.taskStatus} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>{c.taskStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer> : <Empty text="No tasks yet" />}</Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Recent leads" icon={Target} color={LOGO_PALETTE.teal} className="lg:col-span-1">{d.recent.leads.length ? d.recent.leads.map((l) => <div key={l._id} className="flex items-center justify-between border-b border-gray-50 py-2 text-sm last:border-0"><div><p className="font-medium">{l.name}</p><p className="text-xs text-gray-400">{l.assignedTo?.name || 'Unassigned'}</p></div><Badge>{l.status}</Badge></div>) : <Empty />}<Link to="/leads" className="mt-2 block text-xs text-brand-500 hover:text-coral-500 transition-colors underline">View all</Link></Card>
        <Card title="Recent customers" icon={Contact} color={LOGO_PALETTE.coral}>{d.recent.customers.length ? d.recent.customers.map((x) => <div key={x._id} className="flex items-center justify-between border-b border-gray-50 py-2 text-sm last:border-0"><div><p className="font-medium">{x.name}</p><p className="text-xs text-gray-400">{x.owner?.name}</p></div><Badge>{x.admissionStatus}</Badge></div>) : <Empty />}<Link to="/customers" className="mt-2 block text-xs text-brand-500 hover:text-coral-500 transition-colors underline">View all</Link></Card>
        <Card title="Recent activity" icon={History} color={LOGO_PALETTE.teal}>{d.recent.activity.length ? d.recent.activity.map((a) => <div key={a._id} className="border-b border-gray-50 py-2 text-sm last:border-0"><p>{a.summary}</p><p className="text-xs text-gray-400">{a.actorName} · {fmtDT(a.createdAt)}</p></div>) : <Empty />}</Card>
      </div>
    </div>
  );
}
