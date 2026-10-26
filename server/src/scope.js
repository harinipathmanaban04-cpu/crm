const F = { lead: 'assignedTo', task: 'assignee', customer: 'owner', admission: 'owner', invoice: 'owner', payment: 'owner', activity: 'actor' };
// Record-level scope used by every query: super admin = all, admin = own team, sales = own records.
export function scopeFor(u, kind) {
  if (kind === 'course') return {};
  if (u.role === 'superadmin') return {};
  if (u.role === 'admin') {
    if (!u.team) return kind === 'activity' ? { actor: u._id } : { _id: null };
    return kind === 'activity' ? { $or: [{ team: u.team }, { actor: u._id }] } : { team: u.team };
  }
  return { [F[kind]]: u._id };
}
