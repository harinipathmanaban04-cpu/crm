const F = { lead: 'assignedTo', task: 'assignee', customer: 'owner', admission: 'owner', invoice: 'owner', payment: 'owner', activity: 'actor' };
// Record-level scope used by every query: super admin = all, admin = own team/assigned/created, sales = own records.
export function scopeFor(u, kind) {
  if (!u) return { _id: null };
  if (kind === 'course') return {};
  if (u.role === 'superadmin') return {};
  if (u.role === 'admin') {
    if (kind === 'lead') {
      const or = [{ admin: u._id }, { assignedTo: u._id }, { createdBy: u._id }];
      if (u.team) or.push({ team: u.team });
      return { $or: or };
    }
    const or = [{ owner: u._id }, { createdBy: u._id }];
    if (u.team) or.push({ team: u.team });
    if (kind === 'activity') or.push({ actor: u._id });
    return { $or: or };
  }
  if (kind === 'lead') {
    return { $or: [{ assignedTo: u._id }, { createdBy: u._id }] };
  }
  return { [F[kind]]: u._id };
}
