import { Router } from 'express';
import { Lead, Task } from '../models.js';
import { scopeFor } from '../scope.js';
import { requireRole } from '../middleware.js';
import { endOfToday } from '../util.js';

// Additive endpoints used by the Sales Executive mobile app. Every query is scoped to the caller's own records.
const r = Router();
r.use(requireRole('sales'));

// Notification feed derived from real data: new/re-assigned leads, assigned tasks, due follow-ups, overdue tasks.
r.get('/notifications', async (req, res) => {
  const uid = String(req.user._id); const now = new Date();
  const notHidden = { deletedFor: { $ne: req.user._id } };
  const [leads, tasks, due, overdue] = await Promise.all([
    Lead.find({ $and: [scopeFor(req.user, 'lead'), notHidden] }).select('name leadId history').sort('-updatedAt').limit(50).lean(),
    Task.find(scopeFor(req.user, 'task')).select('title dueDate createdAt status').sort('-createdAt').limit(20).lean(),
    Lead.find({ $and: [scopeFor(req.user, 'lead'), notHidden, { nextFollowUp: { $ne: null, $lte: endOfToday() }, status: { $nin: ['Converted', 'Lost'] } }] }).select('name leadId nextFollowUp').limit(20).lean(),
    Task.find({ $and: [scopeFor(req.user, 'task'), { status: { $in: ['To Do', 'In Progress'] }, dueDate: { $lt: now } }] }).select('title dueDate').limit(20).lean(),
  ]);
  const items = [];
  for (const l of leads) for (const h of l.history || []) if (['assigned', 'reassigned'].includes(h.type) && String(h.to) === uid)
    items.push({ id: `a-${l._id}-${+new Date(h.at)}`, type: 'lead_assigned', title: 'New lead assigned', body: `${l.name} (${l.leadId})`, at: h.at, leadId: String(l._id) });
  for (const t of tasks) if (now - new Date(t.createdAt) < 30 * 864e5) items.push({ id: `t-${t._id}`, type: 'task_assigned', title: 'Task assigned', body: t.title, at: t.createdAt });
  for (const l of due) items.push({ id: `f-${l._id}`, type: 'followup_due', title: 'Follow-up due', body: `${l.name} (${l.leadId})`, at: l.nextFollowUp, leadId: String(l._id) });
  for (const t of overdue) items.push({ id: `o-${t._id}`, type: 'task_overdue', title: 'Task overdue', body: t.title, at: t.dueDate });
  items.sort((a, b) => new Date(b.at) - new Date(a.at));
  res.json({ items: items.slice(0, 60) });
});

// Follow-up schedule for the logged-in Sales Executive, grouped overdue / today / upcoming.
r.get('/followups', async (req, res) => {
  const start = new Date(); start.setHours(0, 0, 0, 0); const end = endOfToday();
  const base = { $and: [scopeFor(req.user, 'lead'), { deletedFor: { $ne: req.user._id } }, { nextFollowUp: { $ne: null }, status: { $nin: ['Converted', 'Lost'] } }] };
  const sel = 'name leadId phone email status priority nextFollowUp course';
  const q = (f, sort) => Lead.find({ $and: [...base.$and, f] }).select(sel).populate('course', 'name').sort(sort).limit(100).lean();
  const [overdue, today, upcoming] = await Promise.all([
    q({ nextFollowUp: { $lt: start } }, 'nextFollowUp'), q({ nextFollowUp: { $gte: start, $lte: end } }, 'nextFollowUp'), q({ nextFollowUp: { $gt: end } }, 'nextFollowUp'),
  ]);
  res.json({ overdue, today, upcoming });
});
export default r;
