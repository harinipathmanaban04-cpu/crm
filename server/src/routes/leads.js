import mongoose from 'mongoose';
import { Lead, LeadRemoval, User, Team, Customer, Task, Notification, nextSeq, LEAD_STATUSES } from '../models.js';
import { crud } from './crud.js';
import { requireRole } from '../middleware.js';
import { scopeFor } from '../scope.js';
import { pick, diff, httpErr, endOfToday } from '../util.js';
import { emit, emitRooms } from '../realtime.js';
import { log } from '../services/activity.js';
import { assertUnique } from '../services/customer.js';

export function canUserHideLead(user, lead) {
  if (!user || !lead) return false;
  // Super Admin can manage/hide any lead from their view
  if (user.role === 'superadmin') return true;

  const userIdStr = String(user._id || user);
  const createdByStr = lead.createdBy ? String(lead.createdBy._id || lead.createdBy) : null;
  const assignedToStr = lead.assignedTo ? String(lead.assignedTo._id || lead.assignedTo) : null;
  const adminStr = lead.admin ? String(lead.admin._id || lead.admin) : null;
  const leadTeamStr = lead.team ? String(lead.team._id || lead.team) : null;
  const userTeamStr = user.team ? String(user.team._id || user.team) : null;

  // The creator of the lead is always allowed to remove/restore that lead from their own view
  if (createdByStr && createdByStr === userIdStr) {
    return true;
  }

  // Admin role: allowed if assigned as admin, assigned as lead owner, or lead is in admin's team
  if (user.role === 'admin') {
    if (adminStr && adminStr === userIdStr) return true;
    if (assignedToStr && assignedToStr === userIdStr) return true;
    if (userTeamStr && leadTeamStr && userTeamStr === leadTeamStr) return true;
    return false;
  }

  // Sales Executive: allowed if lead is assigned to them (or created by them)
  if (user.role === 'sales') {
    if (assignedToStr && assignedToStr === userIdStr) return true;
    return false;
  }

  return false;
}

const POP = [{ path: 'assignedTo', select: 'name email' }, { path: 'admin', select: 'name' }, { path: 'team', select: 'name' }, { path: 'createdBy', select: 'name' }, { path: 'course', select: 'name' },
  { path: 'history.to', select: 'name' }, { path: 'history.from', select: 'name' }, { path: 'history.by', select: 'name' }, { path: 'history.team', select: 'name' }, { path: 'followUps.by', select: 'name' }];
const FIELDS = ['name', 'phone', 'email', 'address', 'location', 'course', 'source', 'status', 'priority', 'nextFollowUp', 'notes'];

async function resolveAssignment(user, assignedToId, teamId) {
  let team = null, assignedTo = null;
  if (user.role === 'sales') {
    assignedTo = user._id;
    team = user.team || null;
  } else if (assignedToId) {
    const se = await User.findOne({ _id: assignedToId, role: 'sales', active: true });
    if (!se) throw httpErr(400, 'Invalid Sales Executive');
    if (user.role === 'admin' && user.team && se.team && String(se.team) !== String(user.team)) {
      throw httpErr(403, 'You can only assign to Sales Executives in your team');
    }
    assignedTo = se._id;
    team = se.team || user.team || null;
  } else if (user.role === 'admin') {
    team = user.team || null;
  } else if (teamId) {
    team = teamId;
  }
  const t = team ? await Team.findById(team) : null;
  return { assignedTo, team: team || null, admin: t?.admin || (user.role === 'admin' ? user._id : null) };
}
const scoped = (req) => Lead.findOne({
  $and: [
    { _id: req.params.id },
    scopeFor(req.user, 'lead'),
    req.query.includeHidden === '1'
      ? {}
      : req.query.hidden === '1'
      ? { deletedFor: req.user._id }
      : { deletedFor: { $ne: req.user._id } },
  ],
});

const router = crud({
  Model: Lead, kind: 'lead', populate: POP, listSelect: '-history -followUps',
  search: ['name', 'phone', 'email', 'address', 'location', 'leadId'], filters: ['status', 'priority', 'source', 'course', 'team', 'admin', 'assignedTo'],
  extra: (req) => [
    req.query.hidden === '1'
      ? { deletedFor: req.user._id }
      : { deletedFor: { $ne: req.user._id } },
    req.query.unassigned === '1' && { assignedTo: null },
    req.query.followUp === 'due' && { nextFollowUp: { $ne: null, $lte: endOfToday() }, status: { $nin: ['Converted', 'Lost'] } },
  ],
  create: {
    roles: ['superadmin', 'admin', 'sales'],
    build: async (req) => {
      const a = await resolveAssignment(req.user, req.body.assignedTo, req.body.team);
      return { ...pick(req.body, FIELDS), ...a, createdBy: req.user._id, leadId: 'LD-' + String(await nextSeq('lead')).padStart(5, '0'),
        history: a.assignedTo ? [{ type: 'assigned', to: a.assignedTo, team: a.team, by: req.user._id }] : [{ type: 'created', by: req.user._id, team: a.team }] };
    },
  },
  update: {
    apply: async (req, doc) => {
      const keys = req.user.role === 'sales' ? ['status', 'notes', 'nextFollowUp', 'priority', 'address', 'location'] : FIELDS;
      const updates = pick(req.body, keys);
      if (updates.email !== undefined) updates.email = updates.email ? String(updates.email).trim().toLowerCase() : undefined;
      if (updates.address !== undefined) updates.address = updates.address ? String(updates.address).trim() : undefined;
      if (updates.location !== undefined) updates.location = updates.location ? String(updates.location).trim() : undefined;
      Object.assign(doc, updates);
    },
  },
  remove: {
    roles: ['superadmin', 'admin', 'sales'],
    check: async (doc, req) => {
      if (!canUserHideLead(req.user, doc)) {
        throw httpErr(403, 'You do not have permission to remove this lead');
      }
    },
    action: async (doc, req, res) => {
      // Per-user soft-delete: remove lead only from req.user's view without destroying shared record
      const alreadyHidden = doc.deletedFor?.some((id) => String(id) === String(req.user._id));
      if (!alreadyHidden) {
        await Lead.updateOne(
          { _id: doc._id },
          {
            $addToSet: { deletedFor: req.user._id },
            $push: {
              history: {
                type: 'removed_from_view',
                by: req.user._id,
                team: doc.team,
                at: new Date(),
              },
            },
          }
        );
      }
      await LeadRemoval.updateOne(
        { leadId: doc._id, userId: req.user._id },
        { $set: { leadId: doc._id, userId: req.user._id, lead: doc._id, user: req.user._id, removedAt: new Date() } },
        { upsert: true }
      ).catch((err) => console.warn('LeadRemoval upsert error:', err.message));
      await log(req.user, 'lead.hidden', 'Lead', doc._id, `Removed lead ${doc.name} from view`, { team: doc.team });
      emit('lead:updated', doc);
      emit('lead:deleted', { id: String(doc._id), user: String(req.user._id) });
      res.json({ ok: true, message: alreadyHidden ? 'Lead already removed from your view' : 'Lead removed from your view' });
    },
  },
  onCreate: async (doc, req) => {
    await log(req.user, 'lead.created', 'Lead', doc._id, `Created lead ${doc.name} (${doc.leadId})`, { team: doc.team });
    emit('lead:created', doc); if (doc.assignedTo) emit('lead:assigned', doc);
  },
  onUpdate: async (doc, req, before) => {
    const changes = diff(before, doc, ['status', 'priority', 'nextFollowUp', 'name', 'phone', 'email', 'address', 'course']);
    await log(req.user, 'lead.updated', 'Lead', doc._id, `Updated lead ${doc.name}${changes.find((c) => c.field === 'status') ? ` → ${doc.status}` : ''}`, { team: doc.team, changes });
    emit('lead:updated', doc);
  },
});

router.post('/:id/assign', requireRole('superadmin', 'admin'), async (req, res) => {
  const lead = await scoped(req); if (!lead) throw httpErr(404, 'Lead not found');
  const a = await resolveAssignment(req.user, req.body.assignedTo, null);
  if (!a.assignedTo) throw httpErr(400, 'Select a Sales Executive');
  const prev = lead.assignedTo;
  Object.assign(lead, a); lead.history.push({ type: prev ? 'reassigned' : 'assigned', from: prev, to: a.assignedTo, team: a.team, by: req.user._id });
  await lead.save();
  await log(req.user, 'lead.assigned', 'Lead', lead._id, `${prev ? 'Reassigned' : 'Assigned'} lead ${lead.name}`, { team: lead.team });
  emit('lead:assigned', lead, [prev]); emit('lead:updated', lead, [prev]);

  // Create notification for the assigned sales executive (only sales, never superadmin)
  if (a.assignedTo && String(a.assignedTo) !== String(req.user._id)) {
    const se = await User.findById(a.assignedTo);
    if (se && se.role === 'sales') {
      const notif = await Notification.create({
        recipient: se._id,
        type: 'lead_assigned',
        title: 'New lead assigned to you',
        message: `${req.user.name} has assigned lead "${lead.name}" to you`,
        data: { leadId: String(lead._id), assignedBy: String(req.user._id) },
      });
      emitRooms('notification:new', [`user:${se._id}`], { id: String(notif._id), unread: 1 });
    }
  }

  res.json(await Lead.findById(lead._id).populate(POP));
});

router.post('/:id/followup', async (req, res) => {
  const lead = await scoped(req); if (!lead) throw httpErr(404, 'Lead not found');
  if (!req.body.note?.trim()) throw httpErr(400, 'Follow-up note is required');
  const next = req.body.next || null;
  lead.followUps.push({ note: req.body.note.trim(), by: req.user._id, next });
  lead.nextFollowUp = next;
  if (req.body.status && LEAD_STATUSES.includes(req.body.status)) lead.status = req.body.status;
  await lead.save();
  await log(req.user, 'lead.followup', 'Lead', lead._id, `Follow-up recorded for ${lead.name}`, { team: lead.team });
  emit('lead:updated', lead);
  res.json(await Lead.findById(lead._id).populate(POP));
});

router.post('/:id/convert', async (req, res) => {
  const lead = await scoped(req); if (!lead) throw httpErr(404, 'Lead not found');
  if (lead.customer) throw httpErr(409, 'Lead already converted to a customer');
  await assertUnique(lead);
  const c = await Customer.create({ name: lead.name, phone: lead.phone, email: lead.email, address: lead.address, course: lead.course, owner: lead.assignedTo || req.user._id, team: lead.team || req.user.team, createdBy: req.user._id, lead: lead._id, admissionStatus: 'In Progress' });
  lead.customer = c._id; lead.status = 'Converted'; await lead.save();
  await log(req.user, 'lead.converted', 'Lead', lead._id, `Converted lead ${lead.name} to customer`, { team: lead.team });
  emit('lead:updated', lead); emit('customer:created', c);
  res.json(await Lead.findById(lead._id).populate(POP));
});

// Bulk assign leads to an Admin (SuperAdmin only)
router.post('/bulk-assign-admin', requireRole('superadmin'), async (req, res) => {
  const { leadIds, adminId } = req.body;
  if (!Array.isArray(leadIds) || !leadIds.length) throw httpErr(400, 'Select at least one lead');
  if (!adminId) throw httpErr(400, 'Select an Admin to assign to');

  const admin = await User.findOne({ _id: adminId, role: 'admin', active: true });
  if (!admin) throw httpErr(400, 'Invalid or inactive Admin account');

  const leads = await Lead.find({ _id: { $in: leadIds } });
  if (!leads.length) throw httpErr(404, 'No valid leads found');

  let assigned = 0;
  for (const lead of leads) {
    const prev = lead.admin;
    lead.admin = admin._id;
    if (admin.team) lead.team = admin.team;
    lead.history.push({
      type: prev ? 'reassigned_admin' : 'assigned_admin',
      from: prev,
      to: admin._id,
      team: admin.team,
      by: req.user._id,
    });
    await lead.save();
    emit('lead:assigned', lead);
    emit('lead:updated', lead);
    assigned++;
  }

  // Create notification for the admin (only admin, never superadmin)
  if (admin && admin.role === 'admin') {
    const notif = await Notification.create({
      recipient: admin._id,
      type: 'lead_assigned',
      title: `${assigned} lead${assigned !== 1 ? 's' : ''} assigned to you`,
      message: `${req.user.name} has assigned ${assigned} lead${assigned !== 1 ? 's' : ''} to you`,
      data: { count: assigned, assignedBy: String(req.user._id) },
    });
    emitRooms('notification:new', [`user:${admin._id}`], { id: String(notif._id), unread: 1 });
  }

  await log(req.user, 'lead.bulk-assigned-admin', 'Lead', null, `Assigned ${assigned} leads to Admin ${admin.name}`, {});
  res.json({ ok: true, assigned });
});

// Bulk assign leads to a Sales Executive (Admin or SuperAdmin)
router.post('/bulk-assign-sales', requireRole('superadmin', 'admin'), async (req, res) => {
  const { leadIds, salesId } = req.body;
  if (!Array.isArray(leadIds) || !leadIds.length) throw httpErr(400, 'Select at least one lead');
  if (!salesId) throw httpErr(400, 'Select a Sales Executive');

  const se = await User.findOne({ _id: salesId, role: 'sales', active: true });
  if (!se) throw httpErr(400, 'Invalid or inactive Sales Executive');

  // Admin can only assign to their own team's Sales Execs
  if (req.user.role === 'admin' && req.user.team && String(se.team) !== String(req.user.team)) {
    throw httpErr(403, 'You can only assign to Sales Executives in your team');
  }

  // Find leads in scope
  const scopeFilter = scopeFor(req.user, 'lead');
  const leads = await Lead.find({ _id: { $in: leadIds }, ...scopeFilter });
  if (!leads.length) throw httpErr(404, 'No leads found in your scope');

  let assigned = 0;
  for (const lead of leads) {
    const prev = lead.assignedTo;
    lead.assignedTo = se._id;
    if (se.team) lead.team = se.team;
    lead.history.push({
      type: prev ? 'reassigned' : 'assigned',
      from: prev,
      to: se._id,
      team: se.team,
      by: req.user._id,
    });
    await lead.save();
    emit('lead:assigned', lead, [prev]);
    emit('lead:updated', lead, [prev]);
    assigned++;
  }

  // Create notification for the sales exec (only sales executive, never superadmin)
  if (se && se.role === 'sales') {
    const notif = await Notification.create({
      recipient: se._id,
      type: 'lead_assigned',
      title: `${assigned} lead${assigned !== 1 ? 's' : ''} assigned to you`,
      message: `${req.user.name} has assigned ${assigned} lead${assigned !== 1 ? 's' : ''} to you`,
      data: { count: assigned, assignedBy: String(req.user._id) },
    });
    emitRooms('notification:new', [`user:${se._id}`], { id: String(notif._id), unread: 1 });
  }

  await log(req.user, 'lead.bulk-assigned-sales', 'Lead', null, `Assigned ${assigned} leads to Sales Executive ${se.name}`, {});
  res.json({ ok: true, assigned });
});

// Bulk remove leads (per-user soft removal)
async function handleBulkDelete(req, res) {
  const leadIds = req.body.leadIds || req.body.ids;
  if (!Array.isArray(leadIds) || !leadIds.length) {
    throw httpErr(400, 'Select at least one lead to remove');
  }

  // Validate that all elements are valid ObjectIds
  const invalid = leadIds.filter((id) => !id || !mongoose.Types.ObjectId.isValid(String(id)));
  if (invalid.length > 0) {
    throw httpErr(400, `Invalid lead ID(s): ${invalid.slice(0, 3).join(', ')}`);
  }

  // Convert to ObjectId strings to deduplicate
  const uniqueIds = [...new Set(leadIds.map(String))];

  // Fetch all requested leads from database
  const leads = await Lead.find({ _id: { $in: uniqueIds } });
  if (!leads.length) {
    throw httpErr(404, 'No matching leads found');
  }

  // Verify permission for each selected lead
  const authorizedLeads = [];
  const unauthorizedIds = [];

  for (const id of uniqueIds) {
    const lead = leads.find((l) => String(l._id) === String(id));
    if (lead && canUserHideLead(req.user, lead)) {
      authorizedLeads.push(lead);
    } else {
      unauthorizedIds.push(id);
    }
  }

  // Handle case where none of the selected leads are authorized
  if (!authorizedLeads.length) {
    throw httpErr(403, 'You do not have permission to remove the selected lead(s)');
  }

  const newlyHiddenLeads = authorizedLeads.filter((l) => !l.deletedFor?.some((id) => String(id) === String(req.user._id)));
  const authorizedIds = newlyHiddenLeads.map((l) => l._id);

  // Per-user soft-delete: Add req.user._id to deletedFor array
  const result = await Lead.updateMany(
    { _id: { $in: authorizedIds } },
    {
      $addToSet: { deletedFor: req.user._id },
      $push: {
        history: {
          type: 'removed_from_view',
          by: req.user._id,
          at: new Date(),
        },
      },
    }
  );

  // Maintain separate LeadRemoval tracking records (lead, user, removedAt)
  const removalOps = authorizedIds.map((leadId) => ({
    updateOne: {
      filter: { leadId, userId: req.user._id },
      update: {
        $set: {
          leadId,
          userId: req.user._id,
          lead: leadId,
          user: req.user._id,
          removedAt: new Date(),
        },
      },
      upsert: true,
    },
  }));
  if (removalOps.length) {
    await LeadRemoval.bulkWrite(removalOps).catch((err) =>
      console.warn('LeadRemoval bulkWrite error:', err.message)
    );
  }

  const deletedCount = result.modifiedCount || authorizedIds.length;

  // Log activity
  await log(
    req.user,
    'lead.bulk-hidden',
    'Lead',
    null,
    `Removed ${deletedCount} lead${deletedCount !== 1 ? 's' : ''} from view`,
    {
      deletedCount,
      requestedCount: uniqueIds.length,
      unauthorizedCount: unauthorizedIds.length,
      leadIds: authorizedIds.map(String),
      names: authorizedLeads.slice(0, 10).map((l) => l.name),
    }
  );

  // Emit realtime updates
  for (const lead of newlyHiddenLeads) {
    emit('lead:deleted', { id: String(lead._id), user: String(req.user._id) });
    emit('lead:updated', lead);
  }

  let message = `Successfully removed ${deletedCount} lead${deletedCount !== 1 ? 's' : ''} from your view`;
  if (unauthorizedIds.length > 0) {
    message += `. ${unauthorizedIds.length} lead${unauthorizedIds.length !== 1 ? 's were' : ' was'} skipped (no permission).`;
  }

  res.json({
    success: true,
    ok: true,
    removedCount: deletedCount,
    deletedCount,
    skippedCount: unauthorizedIds.length,
    unauthorizedCount: unauthorizedIds.length,
    removedIds: authorizedIds.map(String),
    deletedIds: authorizedIds.map(String),
    skippedIds: unauthorizedIds,
    unauthorizedIds,
    message,
  });
}

// GET /removed: return removal records for authenticated user with populated lead details
async function handleGetRemoved(req, res) {
  const [removals, legacyLeads] = await Promise.all([
    LeadRemoval.find({
      $or: [{ userId: req.user._id }, { user: req.user._id }],
    })
      .sort('-removedAt')
      .populate({
        path: 'lead',
        populate: [
          { path: 'assignedTo', select: 'name email' },
          { path: 'admin', select: 'name' },
          { path: 'team', select: 'name' },
          { path: 'createdBy', select: 'name' },
          { path: 'course', select: 'name fee' },
        ],
      })
      .populate({
        path: 'leadId',
        populate: [
          { path: 'assignedTo', select: 'name email' },
          { path: 'admin', select: 'name' },
          { path: 'team', select: 'name' },
          { path: 'createdBy', select: 'name' },
          { path: 'course', select: 'name fee' },
        ],
      })
      .lean(),
    Lead.find({ deletedFor: req.user._id })
      .populate([
        { path: 'assignedTo', select: 'name email' },
        { path: 'admin', select: 'name' },
        { path: 'team', select: 'name' },
        { path: 'createdBy', select: 'name' },
        { path: 'course', select: 'name fee' },
      ])
      .lean(),
  ]);

  const seen = new Set();
  const items = [];

  for (const r of removals) {
    const lead = r.leadId || r.lead;
    if (!lead || !lead._id) continue;
    const idStr = String(lead._id);
    if (!seen.has(idStr)) {
      seen.add(idStr);
      items.push({
        ...lead,
        removedAt: r.removedAt || lead.updatedAt || new Date(),
        removalId: r._id,
      });
    }
  }

  for (const lead of legacyLeads) {
    const idStr = String(lead._id);
    if (!seen.has(idStr)) {
      seen.add(idStr);
      items.push({
        ...lead,
        removedAt: lead.updatedAt || new Date(),
      });
    }
  }

  res.json({
    success: true,
    ok: true,
    count: items.length,
    total: items.length,
    page: 1,
    pages: 1,
    items,
  });
}

// Single restore endpoint: restore lead to user's view
router.post('/:id/restore', requireRole('superadmin', 'admin', 'sales'), async (req, res) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) throw httpErr(404, 'Lead not found');

  if (!canUserHideLead(req.user, lead)) {
    throw httpErr(403, 'You do not have permission to restore this lead');
  }

  const wasHidden = lead.deletedFor?.some((id) => String(id) === String(req.user._id));
  if (wasHidden) await Lead.updateOne({ _id: lead._id }, { $pull: { deletedFor: req.user._id } });
  if (wasHidden) await LeadRemoval.deleteMany({
    $or: [
      { leadId: lead._id, userId: req.user._id },
      { lead: lead._id, user: req.user._id },
    ],
  }).catch((err) => console.warn('LeadRemoval delete error:', err.message));

  if (wasHidden) {
    lead.history.push({ type: 'restored_to_view', by: req.user._id, at: new Date() });
    await lead.save();
  }

  if (wasHidden) await log(req.user, 'lead.restored', 'Lead', lead._id, `Restored lead ${lead.name} to view`, { team: lead.team});
  if (wasHidden) emit('lead:updated', lead);
  res.json({ success: true, ok: true, message: wasHidden ? 'Lead restored to your view' : 'Lead already restored to your view' });
});

// Bulk restore endpoint: restore multiple leads to user's view
async function handleBulkRestore(req, res) {
  const leadIds = req.body.leadIds || req.body.ids;
  if (!Array.isArray(leadIds) || !leadIds.length) throw httpErr(400, 'Select at least one lead to restore');

  const invalid = leadIds.filter((id) => !id || !mongoose.Types.ObjectId.isValid(String(id)));
  if (invalid.length > 0) throw httpErr(400, `Invalid lead ID(s): ${invalid.slice(0, 3).join(', ')}`);

  const uniqueIds = [...new Set(leadIds.map(String))];
  const leads = await Lead.find({ _id: { $in: uniqueIds } });
  if (!leads.length) throw httpErr(404, 'No matching leads found');

  const authorizedLeads = [];
  const unauthorizedIds = [];

  for (const id of uniqueIds) {
    const lead = leads.find((l) => String(l._id) === String(id));
    if (lead && canUserHideLead(req.user, lead)) {
      authorizedLeads.push(lead);
    } else {
      unauthorizedIds.push(id);
    }
  }

  if (!authorizedLeads.length) {
    throw httpErr(403, 'You do not have permission to restore the selected lead(s)');
  }

  const newlyRestoredLeads = authorizedLeads.filter((l) => l.deletedFor?.some((id) => String(id) === String(req.user._id)));
  const authorizedIds = newlyRestoredLeads.map((l) => l._id);
  const result = await Lead.updateMany(
    { _id: { $in: authorizedIds } },
    { $pull: { deletedFor: req.user._id } }
  );
  await LeadRemoval.deleteMany({
    $or: [
      { leadId: { $in: authorizedIds }, userId: req.user._id },
      { lead: { $in: authorizedIds }, user: req.user._id },
    ],
  }).catch(() => {});

  const restoredCount = result.modifiedCount || authorizedIds.length;
  await log(req.user, 'lead.bulk-restored', 'Lead', null, `Restored ${restoredCount} leads to view`, { leadIds: authorizedIds });
  for (const lead of newlyRestoredLeads) {
    emit('lead:updated', lead);
  }

  let message = `Successfully restored ${restoredCount} lead${restoredCount !== 1 ? 's' : ''} to your view`;
  if (unauthorizedIds.length > 0) {
    message += `. ${unauthorizedIds.length} lead${unauthorizedIds.length !== 1 ? 's were' : ' was'} skipped (no permission).`;
  }

  res.json({
    success: true,
    ok: true,
    restoredCount,
    skippedCount: unauthorizedIds.length,
    unauthorizedCount: unauthorizedIds.length,
    restoredIds: authorizedIds.map(String),
    skippedIds: unauthorizedIds,
    unauthorizedIds,
    message,
  });
}

// User-specific lead removal endpoints
router.post('/remove-selected', requireRole('superadmin', 'admin', 'sales'), handleBulkDelete);
router.post('/bulk-delete', requireRole('superadmin', 'admin', 'sales'), handleBulkDelete);
router.delete('/bulk', requireRole('superadmin', 'admin', 'sales'), handleBulkDelete);
router.delete('/bulk-delete', requireRole('superadmin', 'admin', 'sales'), handleBulkDelete);

// User-specific removed leads querying & restoration endpoints
router.get('/removed', requireRole('superadmin', 'admin', 'sales'), handleGetRemoved);
router.post('/restore-selected', requireRole('superadmin', 'admin', 'sales'), handleBulkRestore);
router.post('/bulk-restore', requireRole('superadmin', 'admin', 'sales'), handleBulkRestore);

export default router;
