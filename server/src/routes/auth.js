import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { User, Team } from '../models.js';
import { auth } from '../middleware.js';
import { httpErr, normEmail, strong, pick } from '../util.js';
import { emitRooms } from '../realtime.js';
const r = Router();
const sign = (u) => jwt.sign({ id: u._id, tv: u.tokenVersion }, process.env.JWT_SECRET, { expiresIn: '8h' });

const me = async (id) => {
  const doc = await User.findById(id).populate({
    path: 'team',
    select: 'name admin',
    populate: { path: 'admin', select: 'name email phone role' },
  });
  if (!doc) return null;
  const u = doc.toJSON ? doc.toJSON() : { ...doc };
  delete u.plainPassword;
  if (u.team) {
    if (!u.team.admin) {
      const adminUser = await User.findOne({ team: u.team._id || u.team, role: 'admin', active: true })
        .select('name email phone role')
        .lean();
      if (adminUser) {
        u.team.admin = adminUser;
      }
    }
  }
  return u;
};

r.post('/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: { message: 'Too many attempts. Try again later.' } }), async (req, res) => {
  const { email, password } = req.body;
  const u = await User.findOne({ email: normEmail(email) }).select('+passwordHash');
  if (!u || typeof password !== 'string' || !(await bcrypt.compare(password, u.passwordHash))) throw httpErr(401, 'Invalid email or password');
  if (!u.active) throw httpErr(403, 'Your account is deactivated. Contact the Super Admin.');
  u.lastLogin = new Date(); await u.save();
  res.json({ token: sign(u), user: await me(u._id) });
});
r.get('/me', auth(true), async (req, res) => res.json(await me(req.user._id)));
r.post('/change-password', auth(true), async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const u = await User.findById(req.user._id).select('+passwordHash');
  if (!(await bcrypt.compare(String(currentPassword || ''), u.passwordHash))) throw httpErr(400, 'Current password is incorrect');
  if (!strong(newPassword)) throw httpErr(400, 'New password must be 8+ characters with letters and numbers');
  if (currentPassword === newPassword) throw httpErr(400, 'New password must be different');
  u.passwordHash = await bcrypt.hash(newPassword, 12);
  u.plainPassword = newPassword;
  u.mustChangePassword = false;
  u.tokenVersion += 1;
  await u.save();
  emitRooms('user:updated', ['role:superadmin'], { id: String(u._id) });
  res.json({ token: sign(u), user: await me(u._id) });
});
r.put('/profile', auth(), async (req, res) => {
  const allowed = pick(req.body, ['name', 'phone']);
  if (req.body.avatar !== undefined) allowed.avatar = req.body.avatar || null;
  Object.assign(req.user, allowed); await req.user.save();
  emitRooms('user:updated', ['role:superadmin', ...(req.user.team ? [`team:${req.user.team}`] : [])], { id: String(req.user._id) });
  res.json(await me(req.user._id));
});
export default r;
