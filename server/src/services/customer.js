import { Customer, User } from '../models.js';
import { httpErr, normPhone, normEmail } from '../util.js';
export async function assertUnique({ phone, email }, excludeId) {
  const or = []; const p = normPhone(phone); const e = normEmail(email);
  if (p) or.push({ phoneNorm: p }); if (e) or.push({ emailNorm: e });
  if (!or.length) return;
  const f = { $or: or }; if (excludeId) f._id = { $ne: excludeId };
  if (await Customer.exists(f)) throw httpErr(409, 'A customer with this phone number or email already exists');
}
export async function resolveOwner(user, ownerId) {
  if (user.role === 'sales' || !ownerId) return { owner: user._id, team: user.team };
  const o = await User.findOne({ _id: ownerId, active: true, role: { $in: ['sales', 'admin'] } });
  if (!o) throw httpErr(400, 'Invalid owner');
  if (user.role === 'admin' && String(o.team) !== String(user.team)) throw httpErr(403, 'Owner must be in your team');
  return { owner: o._id, team: o.team };
}
