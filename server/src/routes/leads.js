import { Lead, User, Team, Customer, nextSeq, LEAD_STATUSES } from '../models.js';
import { crud } from './crud.js';
import { requireRole } from '../middleware.js';
import { scopeFor } from '../scope.js';
import { pick, diff, httpErr, endOfToday } from '../util.js';
import { emit } from '../realtime.js';
import { log } from '../services/activity.js';
import { assertUnique } from '../services/customer.js';

const POP = [{ path: 'assignedTo', select: 'name email' }, { path: 'admin', select: 'name' }, { path: 'team', select: 'name' }, { path: 'createdBy', select: 'name' }, { path: 'course', select: 'name' },
  { path: 'history.to', select: 'name' }, { path: 'history.from', select: 'name' }, { path: 'history.by', select: 'name' }, { path: 'history.team', select: 'name' }, { path: 'followUps.by', select: 'name' }];
const FIELDS = ['name', 'phone', 'email', 'course', 'source', 'status', 'priority', 'nextFollowUp', 'notes'];

async function resolveAssignment(user, assignedToId, teamId) {
  let team = null, assignedTo = null;
  if (assignedToId) {
    const se = await User.findOne({ _id: assignedToId, role: 'sales', active: true });
    if (!se) throw httpErr(400, 'Invalid Sales Executive');
    if (user.role === 'admin' && String(se.team) !== String(user.team)) throw httpErr(403, 'You can only assign to Sales Executives in your team');
    assignedTo = se._id; team = se.team;
  } else if (user.role === 'admin') team = user.team;
  else if (teamId) team = teamId;
  const t = team ? await Team.findById(team) : null;
  return { assignedTo, team: team || null, admin: t?.admin || null };
}
const scoped = (req) => Lead.findOne({ $and: [{ _id: req.params.id }, scopeFor(req.user, 'lead')] });

const router = crud({
  Model: Lead, kind: 'lead', populate: POP, listSelect: '-history -followUps',
  search: ['name', 'phone', 'email', 'leadId'], filters: ['status', 'priority', 'source', 'course', 'team', 'admin', 'assignedTo'],
  extra: (req) => [
    req.query.unassigned === '1' && { assignedTo: null },
    req.query.followUp === 'due' && { nextFollowUp: { $ne: null, $lte: endOfToday() }, status: { $nin: ['Converted', 'Lost'] } },
  ],
  create: {
    roles: ['superadmin', 'admin'],
    build: async (req) => {
      const a = await resolveAssignment(req.user, req.body.assignedTo, req.body.team);
      return { ...pick(req.body, FIELDS), ...a, createdBy: req.user._id, leadId: 'LD-' + String(await nextSeq('lead')).padStart(5, '0'),
        history: a.assignedTo ? [{ type: 'assigned', to: a.assignedTo, team: a.team, by: req.user._id }] : [{ type: 'created', by: req.user._id, team: a.team }] };
    },
  },
  update: {
    apply: async (req, doc) => {
      const keys = req.user.role === 'sales' ? ['status', 'notes', 'nextFollowUp', 'priority'] : FIELDS;
      Object.assign(doc, pick(req.body, keys));
    },
  },
  remove: { roles: ['superadmin', 'admin'] },
  onCreate: async (doc, req) => {
    await log(req.user, 'lead.created', 'Lead', doc._id, `Created lead ${doc.name} (${doc.leadId})`, { team: doc.team });
    emit('lead:created', doc); if (doc.assignedTo) emit('lead:assigned', doc);
  },
  onUpdate: async (doc, req, before) => {
    const changes = diff(before, doc, ['status', 'priority', 'nextFollowUp', 'name', 'phone', 'course']);
    await log(req.user, 'lead.updated', 'Lead', doc._id, `Updated lead ${doc.name}${changes.find((c) => c.field === 'status') ? ` → ${doc.status}` : ''}`, { team: doc.team, changes });
    emit('lead:updated', doc);
  },
  onDelete: async (doc, req) => { await log(req.user, 'lead.deleted', 'Lead', doc._id, `Deleted lead ${doc.name}`, { team: doc.team }); emit('lead:updated', doc); },
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
  const c = await Customer.create({ name: lead.name, phone: lead.phone, email: lead.email, course: lead.course, owner: lead.assignedTo || req.user._id, team: lead.team || req.user.team, createdBy: req.user._id, lead: lead._id, admissionStatus: 'In Progress' });
  lead.customer = c._id; lead.status = 'Converted'; await lead.save();
  await log(req.user, 'lead.converted', 'Lead', lead._id, `Converted lead ${lead.name} to customer`, { team: lead.team });
  emit('lead:updated', lead); emit('customer:created', c);
  res.json(await Lead.findById(lead._id).populate(POP));
});
export default router;
