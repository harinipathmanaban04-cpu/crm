import { Customer, Admission, Invoice, Payment, ActivityLog } from '../models.js';
import { crud } from './crud.js';
import { scopeFor } from '../scope.js';
import { pick, httpErr } from '../util.js';
import { emit } from '../realtime.js';
import { log } from '../services/activity.js';
import { assertUnique, resolveOwner } from '../services/customer.js';

const POP = [{ path: 'owner', select: 'name email' }, { path: 'team', select: 'name' }, { path: 'course', select: 'name' }, { path: 'createdBy', select: 'name' }, { path: 'history.by', select: 'name' }];
const FIELDS = ['name', 'phone', 'email', 'course', 'notes', 'admissionStatus'];
const router = crud({
  Model: Customer, kind: 'customer', populate: POP, listSelect: '-history', search: ['name', 'phone', 'email'], filters: ['course', 'admissionStatus', 'owner', 'team'],
  create: {
    build: async (req) => {
      await assertUnique(req.body);
      const o = await resolveOwner(req.user, req.body.owner);
      return { ...pick(req.body, FIELDS), ...o, createdBy: req.user._id, history: [{ by: req.user._id, changes: [{ field: 'created', from: '', to: req.body.name }] }] };
    },
  },
  update: {
    apply: async (req, doc) => {
      const before = doc.toObject();
      await assertUnique({ phone: req.body.phone ?? doc.phone, email: req.body.email ?? doc.email }, doc._id);
      Object.assign(doc, pick(req.body, FIELDS));
      if (req.user.role !== 'sales' && req.body.owner && String(req.body.owner) !== String(doc.owner)) Object.assign(doc, await resolveOwner(req.user, req.body.owner));
      const changes = [...FIELDS, 'owner'].filter((k) => String(before[k] ?? '') !== String(doc[k] ?? '')).map((k) => ({ field: k, from: String(before[k] ?? ''), to: String(doc[k] ?? '') }));
      if (changes.length) doc.history.push({ by: req.user._id, changes });
      doc.$locals.changes = changes;
    },
  },
  remove: { roles: ['superadmin'], check: async (doc) => { if (await Admission.exists({ customer: doc._id }) || await Invoice.exists({ customer: doc._id })) throw httpErr(409, 'Customer has admissions/invoices and cannot be deleted'); } },
  onCreate: async (doc, req) => { await log(req.user, 'customer.created', 'Customer', doc._id, `Added customer ${doc.name}`, { team: doc.team }); emit('customer:created', doc); },
  onUpdate: async (doc, req) => { await log(req.user, 'customer.updated', 'Customer', doc._id, `Updated customer ${doc.name}`, { team: doc.team, changes: doc.$locals.changes || [] }); emit('customer:updated', doc); },
  onDelete: async (doc, req) => { await log(req.user, 'customer.deleted', 'Customer', doc._id, `Deleted customer ${doc.name}`, { team: doc.team }); emit('customer:updated', doc); },
});

router.get('/:id/profile', async (req, res) => {
  const customer = await Customer.findOne({ $and: [{ _id: req.params.id }, scopeFor(req.user, 'customer')] }).populate(POP);
  if (!customer) throw httpErr(404, 'Customer not found');
  const [admissions, invoices, payments, activity] = await Promise.all([
    Admission.find({ customer: customer._id }).populate('course', 'name').lean(),
    Invoice.find({ customer: customer._id }).populate('course', 'name').lean(),
    Payment.find({ customer: customer._id }).populate('invoice', 'invoiceNo').lean(),
    ActivityLog.find({ entityId: customer._id }).sort('-createdAt').limit(20).lean(),
  ]);
  res.json({ customer, admissions, invoices, payments, activity });
});
export default router;
