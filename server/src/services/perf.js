import { Lead, Task } from '../models.js';
const OPEN = ['To Do', 'In Progress'];
const cnt = (cond) => ({ $sum: { $cond: [cond, 1, 0] } });
export async function perfByExecutive(LF, TF) {
  const now = new Date();
  const [la, ta] = await Promise.all([
    Lead.aggregate([{ $match: LF }, { $match: { assignedTo: { $ne: null } } }, { $group: { _id: '$assignedTo', leads: { $sum: 1 }, converted: cnt({ $eq: ['$status', 'Converted'] }), lost: cnt({ $eq: ['$status', 'Lost'] }), followUps: { $sum: { $size: { $ifNull: ['$followUps', []] } } } } }]),
    Task.aggregate([{ $match: TF }, { $match: { assignee: { $ne: null } } }, { $group: { _id: '$assignee', tasks: { $sum: 1 }, completed: cnt({ $eq: ['$status', 'Completed'] }), open: cnt({ $in: ['$status', OPEN] }), overdue: cnt({ $and: [{ $in: ['$status', OPEN] }, { $lt: ['$dueDate', now] }] }) } }]),
  ]);
  const m = {};
  const base = () => ({ leads: 0, converted: 0, lost: 0, followUps: 0, tasks: 0, completed: 0, open: 0, overdue: 0 });
  la.forEach((r) => { m[r._id] = { ...base(), ...r }; });
  ta.forEach((r) => { m[r._id] = { ...(m[r._id] || base()), ...r }; });
  Object.values(m).forEach((r) => { delete r._id; r.rate = r.leads ? Math.round((r.converted / r.leads) * 100) : 0; });
  return (id) => m[String(id)] || { ...base(), rate: 0 };
}
