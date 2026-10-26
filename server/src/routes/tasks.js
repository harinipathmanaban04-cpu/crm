import { Task, User } from '../models.js';
import { crud } from './crud.js';
import { pick, diff, httpErr } from '../util.js';
import { emit } from '../realtime.js';
import { log } from '../services/activity.js';

const POP = [{ path: 'assignee', select: 'name email' }, { path: 'createdBy', select: 'name' }, { path: 'lead', select: 'name leadId' }, { path: 'customer', select: 'name' }, { path: 'team', select: 'name' }];
const FIELDS = ['title', 'description', 'priority', 'dueDate', 'status', 'lead', 'customer'];
async function resolveAssignee(user, id) {
  const a = await User.findOne({ _id: id, role: 'sales', active: true });
  if (!a) throw httpErr(400, 'Select a valid Sales Executive');
  if (user.role === 'admin' && String(a.team) !== String(user.team)) throw httpErr(403, 'You can only assign tasks within your team');
  return a;
}
export default crud({
  Model: Task, kind: 'task', populate: POP, search: ['title', 'description'], filters: ['status', 'priority', 'assignee', 'team'], dateField: 'dueDate',
  extra: (req) => [req.query.overdue === '1' && { status: { $in: ['To Do', 'In Progress'] }, dueDate: { $lt: new Date() } }],
  sort: 'dueDate',
  create: { roles: ['superadmin', 'admin'], build: async (req) => { const a = await resolveAssignee(req.user, req.body.assignee); return { ...pick(req.body, FIELDS), assignee: a._id, team: a.team, createdBy: req.user._id }; } },
  update: {
    apply: async (req, doc) => {
      if (req.user.role === 'sales') { Object.assign(doc, pick(req.body, ['status'])); }
      else {
        Object.assign(doc, pick(req.body, FIELDS));
        if (req.body.assignee && String(req.body.assignee) !== String(doc.assignee)) { const a = await resolveAssignee(req.user, req.body.assignee); doc.assignee = a._id; doc.team = a.team; }
      }
      doc.completedAt = doc.status === 'Completed' ? doc.completedAt || new Date() : null;
    },
  },
  remove: { roles: ['superadmin', 'admin'] },
  onCreate: async (doc, req) => { await log(req.user, 'task.created', 'Task', doc._id, `Created task "${doc.title}"`, { team: doc.team }); emit('task:assigned', doc); },
  onUpdate: async (doc, req, before) => {
    const changes = diff(before, doc, ['status', 'priority', 'dueDate', 'assignee']);
    const reassigned = changes.find((c) => c.field === 'assignee');
    await log(req.user, doc.status === 'Completed' && before.status !== 'Completed' ? 'task.completed' : 'task.updated', 'Task', doc._id, `Task "${doc.title}" → ${doc.status}`, { team: doc.team, changes });
    if (reassigned) emit('task:assigned', doc, [reassigned.from]);
    emit('task:updated', doc, reassigned ? [reassigned.from] : []);
    if (doc.status === 'Completed' && before.status !== 'Completed') emit('task:completed', doc);
  },
  onDelete: async (doc, req) => { await log(req.user, 'task.deleted', 'Task', doc._id, `Deleted task "${doc.title}"`, { team: doc.team }); emit('task:updated', doc); },
});
