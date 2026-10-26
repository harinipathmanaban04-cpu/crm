import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { User } from './models.js';
let io;
const idOf = (v) => v && (v._id || v);
const roomsFor = (u) => [`user:${u._id}`, `role:${u.role}`, ...(u.role === 'admin' && u.team ? [`team:${u.team}`] : [])];

export function initSocket(server, origin) {
  io = new Server(server, { cors: { origin, credentials: true } });
  // Authenticated sockets only; rooms are decided by the server from the DB, never by client-supplied IDs.
  io.use(async (socket, next) => {
    try {
      const p = jwt.verify(socket.handshake.auth?.token, process.env.JWT_SECRET);
      const u = await User.findById(p.id);
      if (!u || !u.active || u.tokenVersion !== p.tv || u.mustChangePassword) return next(new Error('unauthorized'));
      socket.data.user = u;
      next();
    } catch { next(new Error('unauthorized')); }
  });
  io.on('connection', (s) => s.join(roomsFor(s.data.user)));
}

export async function syncUser(userId, { kick = false } = {}) {
  if (!io) return;
  const u = await User.findById(userId);
  const socks = await io.in(`user:${userId}`).fetchSockets();
  for (const s of socks) {
    if (kick || !u || !u.active) { s.emit('session:revoked'); s.disconnect(true); continue; }
    [...s.rooms].filter((r) => r.startsWith('team:') || r.startsWith('role:')).forEach((r) => s.leave(r));
    s.join(roomsFor(u));
    s.emit('user:updated', { id: String(u._id) });
  }
}

export function emit(event, doc, extra = []) {
  if (!io || !doc) return;
  const d = doc.toObject ? doc.toObject() : doc;
  const rooms = new Set(['role:superadmin']);
  const t = idOf(d.team); if (t) rooms.add(`team:${t}`);
  for (const k of ['assignedTo', 'assignee', 'owner']) { const v = idOf(d[k]); if (v) rooms.add(`user:${v}`); }
  extra.forEach((v) => v && rooms.add(`user:${idOf(v)}`));
  io.to([...rooms]).emit(event, { id: String(d._id), at: Date.now() });
}
export const emitRooms = (event, rooms, payload) => io && io.to(rooms).emit(event, payload);
