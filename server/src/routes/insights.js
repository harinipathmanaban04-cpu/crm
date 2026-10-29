import { Router } from 'express';
import mongoose from 'mongoose';
import { Lead, Task, Customer, Admission, Invoice, Payment, User, Team, Course, ActivityLog, LEAD_STATUSES } from '../models.js';
import { scopeFor } from '../scope.js';
import { perfByExecutive } from '../services/perf.js';
import { crud } from './crud.js';
import { rx, endOfToday, httpErr } from '../util.js';

const r = Router();
const toId = (v) => (mongoose.isValidObjectId(v) ? new mongoose.Types.ObjectId(String(v)) : null);
const OPEN = ['To Do', 'In Progress'];
const range = (q, field = 'createdAt') => {
  const d = {}; const f = q.from && new Date(q.from), t = q.to && new Date(q.to + 'T23:59:59.999');
  if (f && !isNaN(f)) d.$gte = f; if (t && !isNaN(t)) d.$lte = t;
  return Object.keys(d).length ? { [field]: d } : null;
};
// builds a scoped filter for one collection; `map` names that collection's team/executive/course/status fields
async function build(u, kind, q, map) {
  const c = [scopeFor(u, kind)]; const add = (k, v) => { if (k && v) c.push({ [k]: v }); };
  if (kind === 'lead') c.push({ deletedFor: { $ne: u._id } });
  if (u.role === 'superadmin') add('team', toId(q.team));
  if (u.role !== 'sales') add(map.exec, toId(q.executive));
  if (u.role === 'superadmin' && q.admin) { const t = await Team.findOne({ admin: toId(q.admin) }); c.push({ team: t ? t._id : new mongoose.Types.ObjectId() }); }
  add(map.course, toId(q.course));
  if (map.status && LEAD_STATUSES.includes(q.status)) add(map.status, q.status);
  const d = range(q); if (d) c.push(d);
  return { $and: c };
}

r.get('/dashboard', async (req, res) => {
  const u = req.user, q = req.query, now = new Date();
  const [L, T, C, A, I] = await Promise.all([
    build(u, 'lead', q, { exec: 'assignedTo', course: 'course', status: 'status' }),
    build(u, 'task', q, { exec: 'assignee' }),
    build(u, 'customer', q, { exec: 'owner', course: 'course' }),
    build(u, 'admission', q, { exec: 'owner', course: 'course' }),
    build(u, 'invoice', q, { exec: 'owner', course: 'course' }),
  ]);
  const and = (f, x) => ({ $and: [f, x] });
  const since = new Date(Date.now() - 13 * 864e5); since.setHours(0, 0, 0, 0);
  const [totalLeads, newLeads, assigned, unassigned, converted, lost, dueToday, customers, pending, overdue, completed, admissions, confirmed, paidInv, unpaidInv,
    activeAdmins, activeSales, statusAgg, dayAgg, taskAgg, money, recentActivity, recentLeads, recentCustomers] = await Promise.all([
    Lead.countDocuments(L), Lead.countDocuments(and(L, { status: 'New' })), Lead.countDocuments(and(L, { assignedTo: { $ne: null } })), Lead.countDocuments(and(L, { assignedTo: null })),
    Lead.countDocuments(and(L, { status: 'Converted' })), Lead.countDocuments(and(L, { status: 'Lost' })),
    Lead.countDocuments(and(L, { nextFollowUp: { $ne: null, $lte: endOfToday() }, status: { $nin: ['Converted', 'Lost'] } })),
    Customer.countDocuments(C),
    Task.countDocuments(and(T, { status: { $in: OPEN } })), Task.countDocuments(and(T, { status: { $in: OPEN }, dueDate: { $lt: now } })), Task.countDocuments(and(T, { status: 'Completed' })),
    Admission.countDocuments(A), Admission.countDocuments(and(A, { status: 'Confirmed' })),
    Invoice.countDocuments(and(I, { status: 'Paid' })), Invoice.countDocuments(and(I, { status: { $in: ['Pending', 'Partially Paid'] } })),
    u.role === 'superadmin' ? User.countDocuments({ role: 'admin', active: true }) : 0,
    u.role === 'superadmin' ? User.countDocuments({ role: 'sales', active: true }) : u.role === 'admin' && u.team ? User.countDocuments({ role: 'sales', active: true, team: u.team }) : 0,
    Lead.aggregate([{ $match: L }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Lead.aggregate([{ $match: and(L, { createdAt: { $gte: since } }) }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, leads: { $sum: 1 }, converted: { $sum: { $cond: [{ $eq: ['$status', 'Converted'] }, 1, 0] } } } }]),
    Task.aggregate([{ $match: T }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Invoice.aggregate([{ $match: I }, { $group: { _id: null, billed: { $sum: '$total' }, collected: { $sum: '$paid' } } }]),
    ActivityLog.find(scopeFor(u, 'activity')).sort('-createdAt').limit(8).lean(),
    Lead.find(L).sort('-createdAt').limit(5).select('name leadId status createdAt assignedTo').populate('assignedTo', 'name').lean(),
    Customer.find(C).sort('-createdAt').limit(5).select('name createdAt owner admissionStatus').populate('owner', 'name').lean(),
  ]);
  const days = []; const dm = Object.fromEntries(dayAgg.map((d) => [d._id, d]));
  for (let i = 13; i >= 0; i--) { const d = new Date(Date.now() - i * 864e5); const k = d.toISOString().slice(0, 10); days.push({ day: k.slice(5), leads: dm[k]?.leads || 0, converted: dm[k]?.converted || 0 }); }
  // team performance: teams for super admin, executives for admin
  let performance = [];
  if (u.role === 'superadmin') {
    const g = await Lead.aggregate([{ $match: and(L, { team: { $ne: null } }) }, { $group: { _id: '$team', leads: { $sum: 1 }, converted: { $sum: { $cond: [{ $eq: ['$status', 'Converted'] }, 1, 0] } } } }]);
    const names = Object.fromEntries((await Team.find({ _id: { $in: g.map((x) => x._id) } }).select('name').lean()).map((t) => [t._id, t.name]));
    performance = g.map((x) => ({ name: names[x._id] || 'Team', leads: x.leads, converted: x.converted }));
  } else if (u.role === 'admin') {
    const g = await Lead.aggregate([{ $match: and(L, { assignedTo: { $ne: null } }) }, { $group: { _id: '$assignedTo', leads: { $sum: 1 }, converted: { $sum: { $cond: [{ $eq: ['$status', 'Converted'] }, 1, 0] } } } }]);
    const names = Object.fromEntries((await User.find({ _id: { $in: g.map((x) => x._id) } }).select('name').lean()).map((t) => [t._id, t.name]));
    performance = g.map((x) => ({ name: names[x._id] || 'User', leads: x.leads, converted: x.converted }));
  }
  res.json({
    stats: { totalLeads, newLeads, assigned, unassigned, converted, lost, dueToday, customers, pending, overdue, completed, admissions, confirmed, paidInv, unpaidInv, activeAdmins, activeSales, billed: money[0]?.billed || 0, collected: money[0]?.collected || 0 },
    charts: { leadStatus: LEAD_STATUSES.map((s) => ({ name: s, value: statusAgg.find((x) => x._id === s)?.count || 0 })), leadsOverTime: days, taskStatus: taskAgg.map((x) => ({ name: x._id, value: x.count })), performance },
    recent: { activity: recentActivity, leads: recentLeads, customers: recentCustomers },
  });
});

r.get('/reports/summary', async (req, res) => {
  const u = req.user, q = req.query;
  const [L, T, A, I] = await Promise.all([
    build(u, 'lead', q, { exec: 'assignedTo', course: 'course' }), build(u, 'task', q, { exec: 'assignee' }),
    build(u, 'admission', q, { exec: 'owner', course: 'course' }), build(u, 'invoice', q, { exec: 'owner', course: 'course' }),
  ]);
  const perf = await perfByExecutive(L, T);
  const uf = u.role === 'superadmin' ? { role: 'sales' } : u.role === 'admin' ? (u.team ? { role: 'sales', team: u.team } : { _id: null }) : { _id: u._id };
  const execs = await User.find(uf).populate('team', 'name').select('name team role').lean();
  const byExecutive = execs.map((e) => ({ _id: e._id, name: e.name, team: e.team?.name || '—', ...perf(e._id) })).sort((a, b) => b.converted - a.converted);
  let byTeam = [], byAdmin = [];
  if (u.role === 'superadmin') {
    const teams = await Team.find().populate('admin', 'name').populate('members', '_id').lean();
    byTeam = teams.map((t) => {
      const rows = byExecutive.filter((e) => t.members.some((m) => String(m._id) === String(e._id)));
      const sum = (k) => rows.reduce((s, x) => s + x[k], 0);
      return { _id: t._id, name: t.name, admin: t.admin?.name || '—', members: rows.length, leads: sum('leads'), converted: sum('converted'), rate: sum('leads') ? Math.round((sum('converted') / sum('leads')) * 100) : 0, tasks: sum('tasks'), completed: sum('completed'), overdue: sum('overdue'), followUps: sum('followUps') };
    });
    byAdmin = byTeam.filter((t) => t.admin !== '—').map((t) => ({ name: t.admin, team: t.name, leads: t.leads, converted: t.converted, rate: t.rate }));
  }
  const [admissionsByCourse, money, outstanding, fu] = await Promise.all([
    Admission.aggregate([{ $match: A }, { $group: { _id: '$course', admissions: { $sum: 1 }, confirmed: { $sum: { $cond: [{ $eq: ['$status', 'Confirmed'] }, 1, 0] } }, fees: { $sum: '$fee' } } }]),
    Invoice.aggregate([{ $match: I }, { $group: { _id: null, billed: { $sum: '$total' }, collected: { $sum: '$paid' } } }]),
    Invoice.find({ $and: [I, { status: { $in: ['Pending', 'Partially Paid'] } }] }).populate('customer', 'name').sort('-createdAt').limit(20).lean(),
    Promise.all([Lead.countDocuments({ $and: [L, { nextFollowUp: { $lt: new Date(), $ne: null }, status: { $nin: ['Converted', 'Lost'] } }] }), Lead.countDocuments({ $and: [L, { nextFollowUp: { $ne: null, $lte: endOfToday(), $gte: new Date(new Date().setHours(0, 0, 0, 0)) } }] }), Lead.countDocuments({ $and: [L, { nextFollowUp: { $gt: endOfToday(), $lte: new Date(Date.now() + 7 * 864e5) } }] })]),
  ]);
  const cn = Object.fromEntries((await Course.find().select('name').lean()).map((c) => [c._id, c.name]));
  res.json({
    byExecutive, byTeam, byAdmin,
    admissionsByCourse: admissionsByCourse.map((x) => ({ course: cn[x._id] || '—', admissions: x.admissions, confirmed: x.confirmed, fees: x.fees })),
    payments: { billed: money[0]?.billed || 0, collected: money[0]?.collected || 0, outstanding: (money[0]?.billed || 0) - (money[0]?.collected || 0), list: outstanding },
    followUps: { overdue: fu[0], today: fu[1], next7: fu[2] },
  });
});

/* CSV export (scoped; guards against spreadsheet formula injection) */
const cell = (v) => { let s = v == null ? '' : v instanceof Date ? v.toISOString() : String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
const EXPORTS = {
  leads: { M: Lead, kind: 'lead', pop: [['assignedTo', 'name'], ['course', 'name'], ['team', 'name']], cols: [['Lead ID', (d) => d.leadId], ['Name', (d) => d.name], ['Phone', (d) => d.phone], ['Email', (d) => d.email], ['Address', (d) => d.address], ['Course', (d) => d.course?.name], ['Source', (d) => d.source], ['Team', (d) => d.team?.name], ['Assigned To', (d) => d.assignedTo?.name], ['Status', (d) => d.status], ['Priority', (d) => d.priority], ['Next Follow-up', (d) => d.nextFollowUp], ['Created', (d) => d.createdAt]] },
  customers: { M: Customer, kind: 'customer', pop: [['owner', 'name'], ['course', 'name'], ['team', 'name']], cols: [['Name', (d) => d.name], ['Phone', (d) => d.phone], ['Email', (d) => d.email], ['Address', (d) => d.address], ['Course', (d) => d.course?.name], ['Owner', (d) => d.owner?.name], ['Team', (d) => d.team?.name], ['Admission', (d) => d.admissionStatus], ['Created', (d) => d.createdAt]] },
  tasks: { M: Task, kind: 'task', pop: [['assignee', 'name']], cols: [['Title', (d) => d.title], ['Assignee', (d) => d.assignee?.name], ['Priority', (d) => d.priority], ['Status', (d) => d.status], ['Due', (d) => d.dueDate], ['Completed', (d) => d.completedAt]] },
  invoices: { M: Invoice, kind: 'invoice', pop: [['customer', 'name'], ['course', 'name']], cols: [['Invoice', (d) => d.invoiceNo], ['Customer', (d) => d.customer?.name], ['Course', (d) => d.course?.name], ['Total', (d) => d.total], ['Paid', (d) => d.paid], ['Balance', (d) => d.total - d.paid], ['Status', (d) => d.status], ['Payment Date', (d) => d.paymentDate], ['Method', (d) => d.method], ['Txn Ref', (d) => d.txnRef]] },
  payments: { M: Payment, kind: 'payment', pop: [['invoice', 'invoiceNo'], ['customer', 'name']], cols: [['Invoice', (d) => d.invoice?.invoiceNo], ['Customer', (d) => d.customer?.name], ['Amount', (d) => d.amount], ['Method', (d) => d.method], ['Txn Ref', (d) => d.txnRef], ['Date', (d) => d.paymentDate], ['Status', (d) => d.status]] },
};
r.get('/reports/export/:type', async (req, res) => {
  const e = EXPORTS[req.params.type]; if (!e) throw httpErr(404, 'Unknown export');
  const c = [scopeFor(req.user, e.kind)];
  if (e.kind === 'lead') c.push({ deletedFor: { $ne: req.user._id } });
  const d = range(req.query); if (d) c.push(d);
  let qy = e.M.find({ $and: c }).sort('-createdAt').limit(10000); e.pop.forEach(([p, s]) => { qy = qy.populate(p, s); });
  const rows = await qy.lean();
  const csv = [e.cols.map(([h]) => cell(h)).join(','), ...rows.map((row) => e.cols.map(([, f]) => cell(f(row))).join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', `attachment; filename="${req.params.type}.csv"`);
  res.send('\ufeff' + csv);
});

r.get('/lookups', async (req, res) => {
  const u = req.user;
  const uf = u.role === 'superadmin' ? { active: true, role: { $in: ['admin', 'sales'] } } : u.role === 'admin' ? (u.team ? { active: true, team: u.team, role: 'sales' } : { _id: null }) : { _id: u._id };
  const [users, teams, courses, customers, leads, invoices] = await Promise.all([
    User.find(uf).select('name role team').populate('team', 'name').sort('name').lean(),
    Team.find(u.role === 'superadmin' ? {} : { _id: u.team || null }).select('name').sort('name').lean(),
    Course.find({ active: true }).select('name fee').sort('name').lean(),
    Customer.find(scopeFor(u, 'customer')).select('name phone').sort('name').limit(500).lean(),
    Lead.find({ ...scopeFor(u, 'lead'), deletedFor: { $ne: u._id } }).select('name leadId').sort('-createdAt').limit(300).lean(),
    Invoice.find({ $and: [scopeFor(u, 'invoice'), { status: { $in: ['Pending', 'Partially Paid'] } }] }).select('invoiceNo total paid customer').populate('customer', 'name').sort('-createdAt').limit(300).lean(),
  ]);
  if (u.role === 'admin') users.push({ _id: u._id, name: u.name + ' (me)', role: 'admin', team: null });
  res.json({ users, teams, courses, customers, leads, invoices });
});

r.get('/search', async (req, res) => {
  const s = String(req.query.q || '').trim(); if (s.length < 2) return res.json({ leads: [], customers: [] });
  const R = rx(s);
  const [leads, customers] = await Promise.all([
    Lead.find({ $and: [scopeFor(req.user, 'lead'), { deletedFor: { $ne: req.user._id } }, { $or: [{ name: R }, { phone: R }, { email: R }, { address: R }, { leadId: R }] }] }).select('name leadId phone status address').limit(5).lean(),
    Customer.find({ $and: [scopeFor(req.user, 'customer'), { $or: [{ name: R }, { phone: R }, { email: R }, { address: R }] }] }).select('name phone address').limit(5).lean(),
  ]);
  res.json({ leads, customers });
});

r.use('/activity', crud({ Model: ActivityLog, kind: 'activity', search: ['summary', 'actorName'], filters: ['entity', 'action', 'entityId', 'actor'] }));
export default r;
