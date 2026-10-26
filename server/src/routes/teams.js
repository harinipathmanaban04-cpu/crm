import { Router } from 'express';
import { Team, User, Lead, Task, Admission } from '../models.js';
import { requireRole } from '../middleware.js';
import { httpErr } from '../util.js';
import { moveUser } from '../services/team.js';
import { perfByExecutive } from '../services/perf.js';
import { log } from '../services/activity.js';
const r = Router();
const OPEN = ['To Do', 'In Progress'];

async function load(filter) {
  const teams = await Team.find(filter).sort('name')
    .populate('admin', 'name email active').populate('members', 'name email active lastLogin')
    .populate('history.user', 'name').populate('history.from', 'name').populate('history.to', 'name').lean();
  const ids = teams.map((t) => t._id);
  const memberIds = teams.flatMap((t) => t.members.map((m) => m._id));
  const perf = await perfByExecutive({ assignedTo: { $in: memberIds } }, { assignee: { $in: memberIds } });
  const [la, ta, aa] = await Promise.all([
    Lead.aggregate([{ $match: { team: { $in: ids } } }, { $group: { _id: '$team', leads: { $sum: 1 }, converted: { $sum: { $cond: [{ $eq: ['$status', 'Converted'] }, 1, 0] } }, unassigned: { $sum: { $cond: [{ $eq: ['$assignedTo', null] }, 1, 0] } } } }]),
    Task.aggregate([{ $match: { team: { $in: ids } } }, { $group: { _id: '$team', open: { $sum: { $cond: [{ $in: ['$status', OPEN] }, 1, 0] } }, overdue: { $sum: { $cond: [{ $and: [{ $in: ['$status', OPEN] }, { $lt: ['$dueDate', new Date()] }] }, 1, 0] } }, completed: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } } } }]),
    Admission.aggregate([{ $match: { team: { $in: ids } } }, { $group: { _id: '$team', admissions: { $sum: 1 } } }]),
  ]);
  const by = (a) => Object.fromEntries(a.map((x) => [String(x._id), x]));
  const L = by(la), T = by(ta), A = by(aa);
  return teams.map((t) => ({
    ...t,
    members: t.members.map((m) => ({ ...m, stats: perf(m._id) })),
    history: (t.history || []).slice(-10).reverse(),
    stats: { leads: L[t._id]?.leads || 0, converted: L[t._id]?.converted || 0, unassigned: L[t._id]?.unassigned || 0, open: T[t._id]?.open || 0, overdue: T[t._id]?.overdue || 0, completed: T[t._id]?.completed || 0, admissions: A[t._id]?.admissions || 0 },
  }));
}

r.get('/', async (req, res) => {
  const u = req.user;
  const filter = u.role === 'superadmin' ? {} : { _id: u.team || null };
  res.json(await load(filter));
});

r.post('/', requireRole('superadmin'), async (req, res) => {
  const { name, adminId } = req.body;
  if (!name?.trim()) throw httpErr(400, 'Team name is required');
  const t = await Team.create({ name: name.trim() });
  if (adminId) { const a = await User.findOne({ _id: adminId, role: 'admin', active: true }); if (!a) throw httpErr(400, 'Invalid Admin'); await moveUser(a, t._id, req.user); }
  await log(req.user, 'team.created', 'Team', t._id, `Created team ${t.name}`, { team: t._id });
  res.status(201).json((await load({ _id: t._id }))[0]);
});

r.put('/:id', requireRole('superadmin'), async (req, res) => {
  const t = await Team.findById(req.params.id); if (!t) throw httpErr(404, 'Team not found');
  if (req.body.name) { t.name = req.body.name.trim(); await t.save(); }
  if (req.body.adminId !== undefined && String(req.body.adminId || '') !== String(t.admin || '')) {
    if (req.body.adminId) { const a = await User.findOne({ _id: req.body.adminId, role: 'admin', active: true }); if (!a) throw httpErr(400, 'Invalid Admin'); await moveUser(a, t._id, req.user); }
    else if (t.admin) await moveUser(await User.findById(t.admin), null, req.user);
  }
  await log(req.user, 'team.updated', 'Team', t._id, `Updated team ${t.name}`, { team: t._id });
  res.json((await load({ _id: t._id }))[0]);
});

// Add a Sales Executive to a team (also transfers them if they are in another team)
r.post('/:id/members', requireRole('superadmin'), async (req, res) => {
  const u = await User.findOne({ _id: req.body.userId, role: 'sales', active: true }); if (!u) throw httpErr(400, 'Invalid Sales Executive');
  const from = u.team; await moveUser(u, req.params.id, req.user);
  await log(req.user, from ? 'team.transfer' : 'team.member-added', 'Team', req.params.id, `${from ? 'Transferred' : 'Added'} ${u.name} to team`, { team: req.params.id });
  res.json({ ok: true });
});
r.delete('/:id/members/:userId', requireRole('superadmin'), async (req, res) => {
  const u = await User.findById(req.params.userId); if (!u || String(u.team) !== req.params.id) throw httpErr(404, 'Member not in this team');
  await moveUser(u, null, req.user);   // login account and records are kept
  await log(req.user, 'team.member-removed', 'Team', req.params.id, `Removed ${u.name} from team`, { team: req.params.id });
  res.json({ ok: true });
});
r.post('/transfer', requireRole('superadmin'), async (req, res) => {
  const u = await User.findOne({ _id: req.body.userId, role: { $in: ['sales', 'admin'] } }); if (!u) throw httpErr(404, 'User not found');
  await moveUser(u, req.body.toTeamId, req.user);
  await log(req.user, 'team.transfer', 'Team', req.body.toTeamId, `Transferred ${u.name} between teams`, { team: req.body.toTeamId });
  res.json({ ok: true });
});
export default r;
