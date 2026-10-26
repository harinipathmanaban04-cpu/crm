import { Team, User, Lead, Task, Customer, Admission, Invoice, Payment } from '../models.js';
import { emitRooms, syncUser } from '../realtime.js';
import { httpErr } from '../util.js';

// Moves a user between teams (or out of a team). Keeps accounts/history, updates authorization immediately.
export async function moveUser(user, toId, by) {
  const fromId = user.team || null; toId = toId || null;
  if (String(fromId || '') === String(toId || '')) return user;
  let toTeam = null;
  if (toId) { toTeam = await Team.findById(toId); if (!toTeam) throw httpErr(404, 'Team not found'); }
  if (fromId) {
    if (user.role === 'admin') { await Team.updateOne({ _id: fromId, admin: user._id }, { $set: { admin: null } }); await Lead.updateMany({ team: fromId, admin: user._id }, { $set: { admin: null } }); }
    else await Team.updateOne({ _id: fromId }, { $pull: { members: user._id } });
  }
  if (toTeam) {
    if (user.role === 'admin') {
      if (toTeam.admin && String(toTeam.admin) !== String(user._id)) { await User.updateOne({ _id: toTeam.admin }, { $set: { team: null } }); await syncUser(toTeam.admin); }
      toTeam.admin = user._id;
      await Lead.updateMany({ team: toId }, { $set: { admin: user._id } });
    } else toTeam.members.addToSet(user._id);
  }
  const h = { user: user._id, from: fromId, to: toId, by: by._id, at: new Date() };
  if (toTeam) { toTeam.history.push(h); await toTeam.save(); }
  if (fromId) await Team.updateOne({ _id: fromId }, { $push: { history: h } });
  user.team = toId; await user.save();
  if (user.role === 'sales') {
    await Lead.updateMany({ assignedTo: user._id }, { $set: { team: toId, admin: toTeam?.admin || null }, $push: { history: { type: 'team-transfer', to: user._id, team: toId, by: by._id, at: new Date() } } });
    await Task.updateMany({ assignee: user._id }, { $set: { team: toId } });
    await Promise.all([Customer, Admission, Invoice, Payment].map((M) => M.updateMany({ owner: user._id }, { $set: { team: toId } })));
  }
  await syncUser(user._id);
  const rooms = ['role:superadmin', `user:${user._id}`]; if (fromId) rooms.push(`team:${fromId}`); if (toId) rooms.push(`team:${toId}`);
  const ev = !fromId ? 'team:member-added' : !toId ? 'team:member-removed' : 'team:member-transferred';
  emitRooms(ev, rooms, { id: String(toId || fromId), userId: String(user._id), from: fromId && String(fromId), to: toId && String(toId) });
  return user;
}
