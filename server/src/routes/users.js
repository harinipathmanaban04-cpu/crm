import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User, Lead, Task, Customer, Team } from '../models.js';
import { requireRole } from '../middleware.js';
import { httpErr, normEmail, strong, pick, rx } from '../util.js';
import { moveUser } from '../services/team.js';
import { syncUser, emitRooms } from '../realtime.js';
import { log } from '../services/activity.js';
const r = Router();
const notify = (u) => emitRooms('user:updated', ['role:superadmin', ...(u.team ? [`team:${u.team}`] : [])], { id: String(u._id) });
const get = (id) => User.findById(id).populate({ path: 'team', select: 'name admin', populate: { path: 'admin', select: 'name email phone' } });
const target = async (id) => { const u = await User.findById(id); if (!u) throw httpErr(404, 'User not found'); if (u.role === 'superadmin') throw httpErr(403, 'Super Admin accounts cannot be modified here'); return u; };

r.get('/', async (req, res) => {
  const q = req.query; const c = [];
  if (req.user.role === 'superadmin') {
    if (q.includeSuper === 'true') {
      c.push({ role: { $in: ['superadmin', 'admin', 'sales'] } });
    } else {
      c.push({ role: { $in: ['admin', 'sales'] } });
    }
  } else if (req.user.role === 'admin') {
    c.push(req.user.team ? { team: req.user.team, role: 'sales' } : { _id: null });
  } else {
    c.push({ _id: req.user._id });
  }
  if (q.role) c.push({ role: String(q.role) }); if (q.active) c.push({ active: q.active === 'true' }); if (q.team) c.push({ team: String(q.team) });
  if (q.q) c.push({ $or: [{ name: rx(q.q) }, { email: rx(q.q) }] });
  const page = Math.max(1, parseInt(q.page) || 1), limit = Math.min(1000, parseInt(q.limit) || 15);
  const f = { $and: c };
  const [items, total] = await Promise.all([User.find(f).populate({ path: 'team', select: 'name admin', populate: { path: 'admin', select: 'name' } }).sort('-createdAt').skip((page - 1) * limit).limit(limit).lean(), User.countDocuments(f)]);
  items.forEach((u) => {
    delete u.tokenVersion;
    if (req.user.role === 'superadmin') {
      // Return actual password set by Super Admin (no dummy passwords)
      u.plainPassword = u.plainPassword || (u.role === 'superadmin' ? (process.env.SEED_PASSWORD || 'Admin@12345') : 'Not Set');
    } else {
      delete u.plainPassword;
    }
  });
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});

r.post('/', requireRole('superadmin'), async (req, res) => {
  const { name, email, role, team, password, phone } = req.body;
  if (!['admin', 'sales'].includes(role)) throw httpErr(400, 'Role must be Admin or Sales Executive');
  if (!strong(password)) throw httpErr(400, 'Password must be 8+ characters with letters and numbers');
  if (await User.exists({ email: normEmail(email) })) throw httpErr(409, 'An account with this email already exists');
  const u = await User.create({
    name,
    email,
    phone,
    role,
    passwordHash: await bcrypt.hash(password, 12),
    plainPassword: password,
    mustChangePassword: false
  });
  if (team) await moveUser(u, team, req.user);
  await log(req.user, 'user.created', 'User', u._id, `Created ${role === 'admin' ? 'Admin' : 'Sales Executive'} account for ${u.name}`, { team: u.team });
  notify(u);
  res.status(201).json(await get(u._id));
});

r.put('/:id', requireRole('superadmin'), async (req, res) => {
  const u = await target(req.params.id); const b = req.body; const changes = [];
  if (b.email && normEmail(b.email) !== u.email) { if (await User.exists({ email: normEmail(b.email), _id: { $ne: u._id } })) throw httpErr(409, 'Email already in use'); changes.push({ field: 'email', from: u.email, to: normEmail(b.email) }); u.email = b.email; }
  if (b.name && b.name !== u.name) { changes.push({ field: 'name', from: u.name, to: b.name }); u.name = b.name; }
  if (b.phone !== undefined) u.phone = b.phone || null;
  if (b.role && b.role !== u.role) {
    if (!['admin', 'sales'].includes(b.role)) throw httpErr(400, 'Invalid role');
    await moveUser(u, null, req.user);           // leave old team before the role changes
    changes.push({ field: 'role', from: u.role, to: b.role }); u.role = b.role; u.tokenVersion += 1;
  }
  if (b.newPassword) {
    if (!strong(b.newPassword)) throw httpErr(400, 'Password must be 8+ characters with letters and numbers');
    u.passwordHash = await bcrypt.hash(b.newPassword, 12);
    u.plainPassword = b.newPassword;
    u.mustChangePassword = false;
    u.tokenVersion += 1;
    changes.push({ field: 'password', from: '', to: 'changed' });
    await syncUser(u._id, { kick: true });
  }
  await u.save();
  if (b.team !== undefined && String(b.team || '') !== String(u.team || '')) { changes.push({ field: 'team', from: String(u.team || ''), to: String(b.team || '') }); await moveUser(u, b.team || null, req.user); }
  await syncUser(u._id);
  await log(req.user, 'user.updated', 'User', u._id, `Updated account of ${u.name}`, { team: u.team, changes });
  notify(u);
  res.json(await get(u._id));
});

r.post('/:id/toggle', requireRole('superadmin'), async (req, res) => {
  const u = await target(req.params.id);
  u.active = !u.active; u.tokenVersion += 1; await u.save();
  if (!u.active) await syncUser(u._id, { kick: true });
  await log(req.user, u.active ? 'user.activated' : 'user.deactivated', 'User', u._id, `${u.active ? 'Activated' : 'Deactivated'} account of ${u.name}`, { team: u.team });
  notify(u);
  res.json(await get(u._id));
});

r.post('/:id/reset-password', requireRole('superadmin'), async (req, res) => {
  const u = await target(req.params.id);
  if (!strong(req.body.password)) throw httpErr(400, 'Password must be 8+ characters with letters and numbers');
  u.passwordHash = await bcrypt.hash(req.body.password, 12);
  u.plainPassword = req.body.password;
  u.mustChangePassword = false;
  u.tokenVersion += 1;
  await u.save();
  await syncUser(u._id, { kick: true });
  await log(req.user, 'user.password-reset', 'User', u._id, `Reset password for ${u.name}`, { team: u.team });
  notify(u);
  res.json({ ok: true });
});
r.delete('/:id', requireRole('superadmin'), async (req, res) => {
  const u = await target(req.params.id);
  if (String(u._id) === String(req.user._id)) throw httpErr(400, 'Cannot delete your own account');
  await moveUser(u, null, req.user);
  await Team.updateMany({ admin: u._id }, { $set: { admin: null } });
  await Lead.updateMany({ assignedTo: u._id }, { $set: { assignedTo: null } });
  await Lead.updateMany({ admin: u._id }, { $set: { admin: null } });
  await Task.updateMany({ assignee: u._id }, { $set: { assignee: null } });
  await Customer.updateMany({ owner: u._id }, { $set: { owner: null } });
  await syncUser(u._id, { kick: true });
  await User.findByIdAndDelete(u._id);
  await log(req.user, 'user.deleted', 'User', u._id, `Deleted account for ${u.name}`, { team: u.team });
  notify(u);
  res.json({ ok: true, message: 'Account deleted successfully' });
});

export default r;
