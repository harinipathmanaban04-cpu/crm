import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import api, { errMsg } from './api';
import { useAuth } from './auth.jsx';
import { useLive } from './socket.jsx';
import { useLookups } from './lookups.jsx';
import { Modal, Confirm, Spinner, Empty, Pagination, Field, toast } from './ui.jsx';

const pad = (n) => String(n).padStart(2, '0');
const localInput = (d) => { const x = new Date(d); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`; };
const initVal = (f, row) => {
  let v = row ? row[f.name] : f.default;
  if (v && typeof v === 'object' && v._id) v = v._id;
  if (f.bool) return String(v ?? true);
  if (v == null) return '';
  if (f.type === 'date') return String(v).slice(0, 10);
  if (f.type === 'datetime') return localInput(v);
  return v;
};

export default function ResourcePage({ title, subtitle, endpoint, columns, filters = [], fields = [], canCreate, canEdit, canDelete, params = {}, events = [], actions, headerActions, newLabel = 'Add New', dateFilter = true, refreshKey = 0, onRowClick, embedded }) {
  const { user } = useAuth(); const lk = useLookups();
  const [data, setData] = useState({ items: [], total: 0, pages: 1 }); const [loading, setLoading] = useState(true);
  const [f, setF] = useState({}); const [qIn, setQIn] = useState(''); const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null); const [del, setDel] = useState(null); const [vals, setVals] = useState({}); const [busy, setBusy] = useState(false);

  useEffect(() => { const t = setTimeout(() => { setF((x) => ({ ...x, q: qIn })); setPage(1); }, 350); return () => clearTimeout(t); }, [qIn]);
  const pk = JSON.stringify(params), fk = JSON.stringify(f);
  const load = useCallback(async () => {
    try {
      const p = { ...params, page, limit: 15 }; Object.entries(f).forEach(([k, v]) => { if (v) p[k] = v; });
      setData((await api.get(endpoint, { params: p })).data);
    } catch (e) { toast(errMsg(e), 'error'); } finally { setLoading(false); }
  }, [endpoint, pk, fk, page, refreshKey]);
  useEffect(() => { load(); }, [load]);
  useLive(events, load);

  const visible = (fl) => !(fl.hidden?.(vals, !!modal?.row, user)) && !(fl.createOnly && modal?.row) && !(fl.editOnly && !modal?.row);
  const openForm = (row) => { const v = {}; fields.forEach((fl) => { v[fl.name] = initVal(fl, row); }); setVals(v); setModal({ row }); };
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const body = {};
      fields.filter(visible).forEach((fl) => {
        let v = vals[fl.name];
        if (fl.type === 'datetime' && v) v = new Date(v).toISOString();
        if (fl.type === 'number' && v !== '') v = Number(v);
        if (fl.bool) v = v === 'true';
        body[fl.name] = v;
      });
      if (modal.row) await api.put(`${endpoint}/${modal.row._id}`, body); else await api.post(endpoint, body);
      toast(modal.row ? 'Updated successfully' : 'Created successfully'); setModal(null); load(); lk.reload?.();
    } catch (err) { toast(errMsg(err), 'error'); } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { await api.delete(`${endpoint}/${del._id}`); toast('Deleted'); setDel(null); load(); } catch (e) { toast(errMsg(e), 'error'); } finally { setBusy(false); }
  };
  const setFilter = (k, v) => { setF((x) => ({ ...x, [k]: v })); setPage(1); };
  const clear = () => { setF({}); setQIn(''); setPage(1); };
  const optsFor = (o) => o.options || lk.options(o.optionsKey);
  const hasActions = canEdit || canDelete || actions;

  return (
    <div className="space-y-4">
      {!embedded && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h1 className="text-xl font-semibold">{title}</h1>{subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}</div>
          <div className="flex flex-wrap items-center gap-2">
            {headerActions}
            {canCreate && <button className="btn btn-primary" onClick={() => openForm(null)}><Plus className="h-4 w-4" />{newLabel}</button>}
          </div>
        </div>
      )}
      {embedded && (canCreate || headerActions) && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {headerActions}
          {canCreate && <button className="btn btn-primary" onClick={() => openForm(null)}><Plus className="h-4 w-4" />{newLabel}</button>}
        </div>
      )}
      <div className="card">
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 p-2.5 sm:p-3">
          <div className="relative w-full sm:w-auto min-w-[180px] sm:flex-1 sm:max-w-xs"><Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" /><input className="input pl-9" placeholder="Search…" value={qIn} onChange={(e) => setQIn(e.target.value)} /></div>
          {filters.filter((x) => !x.hidden?.(user)).map((fl) => (
            <select key={fl.key} className="input flex-1 sm:flex-none w-auto text-xs sm:text-sm" value={f[fl.key] || ''} onChange={(e) => setFilter(fl.key, e.target.value)}>
              <option value="">{fl.label}: All</option>{optsFor(fl).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ))}
          {dateFilter && <><input type="date" className="input flex-1 sm:flex-none w-auto text-xs sm:text-sm" value={f.from || ''} onChange={(e) => setFilter('from', e.target.value)} title="From" /><input type="date" className="input flex-1 sm:flex-none w-auto text-xs sm:text-sm" value={f.to || ''} onChange={(e) => setFilter('to', e.target.value)} title="To" /></>}
          {(Object.values(f).some(Boolean)) && <button className="btn btn-ghost text-xs sm:text-sm" onClick={clear}>Clear</button>}
        </div>
        {loading ? <Spinner /> : data.items.length === 0 ? <Empty text="No records found" /> : (
          <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            <table className="w-full min-w-[620px] sm:min-w-full">
              <thead className="bg-gray-50"><tr>{columns.map((c) => <th key={c.label} className="th">{c.label}</th>)}{hasActions && <th className="th text-right">Actions</th>}</tr></thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((row) => (
                  <tr key={row._id} className={`hover:bg-gray-50 ${onRowClick ? 'cursor-pointer' : ''}`} onClick={() => onRowClick?.(row)}>
                    {columns.map((c) => <td key={c.label} className="td">{c.render ? c.render(row, user) : row[c.key] ?? '—'}</td>)}
                    {hasActions && (
                      <td className="td" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {actions?.(row, { reload: load, user })}
                          {(typeof canEdit === 'function' ? canEdit(row, user) : canEdit) && <button className="icon-btn" title="Edit" onClick={() => openForm(row)}><Pencil className="h-4 w-4" /></button>}
                          {(typeof canDelete === 'function' ? canDelete(row, user) : canDelete) && <button className="icon-btn hover:text-red-600" title="Delete" onClick={() => setDel(row)}><Trash2 className="h-4 w-4" /></button>}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pages={data.pages} total={data.total} onPage={setPage} />
      </div>

      {modal && (
        <Modal title={modal.row ? `Edit ${title}` : newLabel} onClose={() => setModal(null)}>
          <form onSubmit={submit}>
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.filter(visible).map((fl) => <Field key={fl.name} f={fl} value={vals[fl.name]} options={fl.type === 'select' ? optsFor(fl) : []} disabled={fl.readOnly || fl.readOnlyFor === user.role} onChange={(v) => setVals((x) => {
              const next = { ...x, [fl.name]: v };
              if (fl.name === 'customer') {
                const cust = lk.customers?.find((c) => c._id === v);
                next.customerEmail = cust?.email || '';
              }
              if (fl.name === 'mode') {
                if (!x.totalInternshipFee || x.totalInternshipFee === '' || x.totalInternshipFee === 20000 || x.totalInternshipFee === 30000) {
                  next.totalInternshipFee = v === 'Offline' ? 30000 : 20000;
                }
              }
              if (fl.name === 'registrationFee' && (x.total == null || x.total === '')) {
                // keep total in sync for legacy
              }
              return next;
            })} />)}
            </div>
            <div className="mt-6 flex justify-end gap-2"><button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></div>
          </form>
        </Modal>
      )}
      {del && <Confirm text="This action cannot be undone. Delete this record?" busy={busy} onYes={remove} onClose={() => setDel(null)} />}
    </div>
  );
}
