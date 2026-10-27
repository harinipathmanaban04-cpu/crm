import jwt from 'jsonwebtoken';
import { User } from './models.js';
export const auth = (allowTemp = false) => async (req, res, next) => {
  try {
    const h = req.headers.authorization || '';
    if (!h.startsWith('Bearer ')) return res.status(401).json({ message: 'Not authenticated' });
    const p = jwt.verify(h.slice(7), process.env.JWT_SECRET);
    const u = await User.findById(p.id);
    if (!u || !u.active || u.tokenVersion !== p.tv) return res.status(401).json({ message: 'Session expired' });
    if (u.mustChangePassword && !allowTemp) return res.status(403).json({ message: 'Password change required', code: 'PASSWORD_CHANGE_REQUIRED' });
    req.user = u;
    next();
  } catch { res.status(401).json({ message: 'Session expired' }); }
};
export const requireRole = (...roles) => (req, res, next) => {
  if (req.user && roles.includes(req.user.role)) return next();
  console.warn(`[requireRole] Access denied for user ${req.user?._id} (${req.user?.email}, role: ${req.user?.role}). Required roles: [${roles.join(', ')}] on ${req.method} ${req.originalUrl}`);
  return res.status(403).json({ message: 'You do not have permission to do this' });
};
