import { useCallback, useEffect, useState } from 'react';
import { Download, AlarmClock, CalendarClock, Calendar, Wallet } from 'lucide-react';
import api, { errMsg } from '../api';
import { useAuth } from '../auth.jsx';
import { useLive, ALL_EVENTS } from '../socket.jsx';
import { Spinner, Empty, Stat, Card, inr, toast, LOGO_PALETTE } from '../ui.jsx';

const Table = ({ title, cols, rows, index = 0 }) => (
  <Card title={title} index={index} className="p-0 overflow-hidden">
    {rows.length ? (
      <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        <table className="w-full min-w-[620px] sm:min-w-full">
          <thead className="bg-gray-50"><tr>{cols.map(([h]) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">{rows.map((r, i) => <tr key={i}>{cols.map(([h, k]) => <td key={h} className="td">{typeof k === 'function' ? k(r) : r[k]}</td>)}</tr>)}</tbody>
        </table>
      </div>
    ) : <Empty text="No data for this range" />}
  </Card>
);
export default function Reports() {
  const { user } = useAuth(); const [f, setF] = useState({ from: '', to: '' }); const [d, setD] = useState(null);
  const load = useCallback(async () => { try { const p = {}; Object.entries(f).forEach(([k, v]) => v && (p[k] = v)); setD((await api.get('/reports/summary', { params: p })).data); } catch (e) { toast(errMsg(e), 'error'); } }, [f.from, f.to]);
  useEffect(() => { load(); }, [load]);
  useLive(ALL_EVENTS, load);
  const dl = async (type) => {
    try {
      const p = {}; Object.entries(f).forEach(([k, v]) => v && (p[k] = v));
      const { data } = await api.get(`/reports/export/${type}`, { params: p, responseType: 'blob' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(data); a.download = `${type}.csv`; a.click(); URL.revokeObjectURL(a.href);
    } catch (e) { toast(errMsg(e), 'error'); }
  };
  if (!d) return <Spinner />;
  const sales = user.role === 'sales';
  const exp = sales ? ['leads', 'customers', 'tasks'] : ['leads', 'customers', 'tasks', 'invoices', 'payments'];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-xl font-semibold">{sales ? 'My Performance' : user.role === 'admin' ? 'Team Reports' : 'Reports & Performance'}</h1>
        <div className="flex flex-wrap gap-2"><input type="date" className="input w-auto" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /><input type="date" className="input w-auto" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
          {exp.map((t) => <button key={t} className="btn btn-ghost capitalize" onClick={() => dl(t)}><Download className="h-4 w-4" />{t} CSV</button>)}</div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Follow-ups overdue" value={d.followUps.overdue} icon={AlarmClock} index={0} />
        <Stat label="Follow-ups today" value={d.followUps.today} icon={CalendarClock} index={1} />
        <Stat label="Follow-ups next 7 days" value={d.followUps.next7} icon={Calendar} index={2} />
        {!sales && <Stat label="Outstanding balance" value={inr(d.payments.outstanding)} icon={Wallet} index={3} sub={`${inr(d.payments.collected)} collected`} />}
      </div>
      {user.role === 'superadmin' && <Table title="Team performance" index={0} rows={d.byTeam} cols={[['Team', 'name'], ['Admin', 'admin'], ['Members', 'members'], ['Leads', 'leads'], ['Converted', 'converted'], ['Conversion', (r) => r.rate + '%'], ['Tasks done', (r) => `${r.completed}/${r.tasks}`], ['Overdue', 'overdue'], ['Follow-ups', 'followUps']]} />}
      {user.role === 'superadmin' && <Table title="Lead conversion by Admin" index={1} rows={d.byAdmin} cols={[['Admin', 'name'], ['Team', 'team'], ['Leads', 'leads'], ['Converted', 'converted'], ['Conversion', (r) => r.rate + '%']]} />}
      <Table title={sales ? 'My lead & task performance' : 'Sales Executive performance'} index={sales ? 0 : 2} rows={d.byExecutive} cols={[['Executive', 'name'], ['Team', 'team'], ['Leads', 'leads'], ['Converted', 'converted'], ['Lost', 'lost'], ['Conversion', (r) => r.rate + '%'], ['Follow-ups logged', 'followUps'], ['Tasks done', (r) => `${r.completed}/${r.tasks}`], ['Open', 'open'], ['Overdue', 'overdue']]} />
      <Table title="Course admissions" index={sales ? 1 : 3} rows={d.admissionsByCourse} cols={[['Course', 'course'], ['Admissions', 'admissions'], ['Confirmed', 'confirmed'], ['Fees', (r) => inr(r.fees)]]} />
      <Table title="Outstanding invoices" index={sales ? 2 : 4} rows={d.payments.list} cols={[['Invoice', 'invoiceNo'], ['Customer', (r) => r.customer?.name], ['Total', (r) => inr(r.total)], ['Paid', (r) => inr(r.paid)], ['Balance', (r) => inr(r.total - r.paid)], ['Status', 'status']]} />
    </div>
  );
}
