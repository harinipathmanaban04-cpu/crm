import { Router } from 'express';
import { Course, Admission, Invoice, Payment, Customer, nextSeq } from '../models.js';
import { crud } from './crud.js';
import { scopeFor } from '../scope.js';
import { pick, diff, httpErr } from '../util.js';
import { emit } from '../realtime.js';
import { log } from '../services/activity.js';

const R = Router();
const SUPER = ['superadmin'], STAFF = ['superadmin', 'admin'];

/* ---------- Courses ---------- */
R.use('/courses', crud({
  Model: Course, kind: 'course', search: ['name'], filters: ['active'], sort: 'name',
  create: { roles: SUPER, build: async (req) => pick(req.body, ['name', 'fee', 'duration', 'description', 'active']) },
  update: { roles: SUPER, apply: async (req, doc) => Object.assign(doc, pick(req.body, ['name', 'fee', 'duration', 'description', 'active'])) },
  remove: { roles: SUPER, check: async (doc) => { if (await Admission.exists({ course: doc._id })) throw httpErr(409, 'Course has admissions; deactivate it instead'); } },
  onCreate: (d, req) => log(req.user, 'course.created', 'Course', d._id, `Created course ${d.name}`),
  onUpdate: (d, req) => log(req.user, 'course.updated', 'Course', d._id, `Updated course ${d.name}`),
}));

/* ---------- Admissions ---------- */
const APOP = [{ path: 'customer', select: 'name phone' }, { path: 'course', select: 'name' }, { path: 'owner', select: 'name' }, { path: 'team', select: 'name' }];
async function syncCustomer(adm) {
  const map = { Confirmed: 'Admitted', Cancelled: 'Dropped', Pending: 'In Progress' };
  const c = await Customer.findById(adm.customer); if (!c) return;
  c.admissionStatus = adm.stage === 'Dropped' ? 'Dropped' : map[adm.status]; await c.save(); emit('customer:updated', c);
}
R.use('/admissions', crud({
  Model: Admission, kind: 'admission', populate: APOP, filters: ['stage', 'status', 'course', 'owner', 'team'], dateField: 'admissionDate',
  create: {
    build: async (req) => {
      const c = await Customer.findOne({ $and: [{ _id: req.body.customer }, scopeFor(req.user, 'customer')] }); if (!c) throw httpErr(404, 'Customer not found');
      const course = await Course.findById(req.body.course); if (!course) throw httpErr(400, 'Select a course');
      if (await Admission.exists({ customer: c._id, course: course._id, status: { $ne: 'Cancelled' } })) throw httpErr(409, 'This customer already has an admission for this course');
      return { ...pick(req.body, ['stage', 'status', 'admissionDate']), customer: c._id, course: course._id, fee: req.body.fee ?? course.fee, owner: c.owner, team: c.team };
    },
  },
  update: {
    apply: async (req, doc) => {
      Object.assign(doc, pick(req.body, ['stage', 'status', 'admissionDate', 'fee']));
      if (doc.status === 'Confirmed' && !doc.admissionDate) doc.admissionDate = new Date();
    },
  },
  remove: { roles: STAFF, check: async (doc) => { if (await Invoice.exists({ admission: doc._id })) throw httpErr(409, 'Admission has invoices'); } },
  onCreate: async (d, req) => { await syncCustomer(d); await log(req.user, 'admission.created', 'Admission', d._id, 'Created admission record', { team: d.team }); emit('admission:updated', d); },
  onUpdate: async (d, req, b) => { await syncCustomer(d); await log(req.user, 'admission.updated', 'Admission', d._id, `Admission → ${d.stage} / ${d.status}`, { team: d.team, changes: diff(b, d, ['stage', 'status', 'fee']) }); emit('admission:updated', d); },
  onDelete: (d) => emit('admission:updated', d),
}));

/* ---------- Invoices & Payments ---------- */
async function recompute(invoiceId) {
  const inv = await Invoice.findById(invoiceId); if (!inv) return null;
  const pays = await Payment.find({ invoice: inv._id }).sort('paymentDate');
  const ok = pays.filter((p) => p.status === 'Success');
  inv.paid = ok.reduce((s, p) => s + p.amount, 0);
  const has = (s) => pays.some((p) => p.status === s);
  inv.status = inv.paid >= inv.total ? 'Paid' : inv.paid > 0 ? 'Partially Paid' : has('Refunded') ? 'Refunded' : has('Failed') && !has('Pending') ? 'Failed' : 'Pending';
  const last = ok[ok.length - 1];
  inv.paymentDate = last?.paymentDate || null; inv.method = last?.method || null; inv.txnRef = last?.txnRef || null;
  await inv.save(); return inv;
}
const IPOP = [{ path: 'customer', select: 'name phone' }, { path: 'course', select: 'name' }, { path: 'owner', select: 'name' }];
R.use('/invoices', crud({
  Model: Invoice, kind: 'invoice', populate: IPOP, search: ['invoiceNo'], filters: ['status', 'course', 'owner', 'team', 'customer'],
  create: {
    roles: STAFF,
    build: async (req) => {
      const c = await Customer.findOne({ $and: [{ _id: req.body.customer }, scopeFor(req.user, 'customer')] }); if (!c) throw httpErr(404, 'Customer not found');
      return { ...pick(req.body, ['course', 'admission', 'total', 'dueDate']), customer: c._id, owner: c.owner, team: c.team, createdBy: req.user._id, invoiceNo: 'INV-' + String(await nextSeq('invoice')).padStart(5, '0') };
    },
  },
  update: {
    roles: STAFF,
    apply: async (req, doc) => { Object.assign(doc, pick(req.body, ['course', 'total', 'dueDate'])); if (doc.total < doc.paid) throw httpErr(400, 'Total cannot be less than the amount already paid'); },
  },
  remove: { roles: SUPER, check: async (doc) => { if (await Payment.exists({ invoice: doc._id })) throw httpErr(409, 'Invoice has payments and cannot be deleted'); } },
  onCreate: async (d, req) => { await log(req.user, 'invoice.created', 'Invoice', d._id, `Created invoice ${d.invoiceNo}`, { team: d.team }); emit('payment:updated', d); },
  onUpdate: async (d, req) => { await recompute(d._id); await log(req.user, 'invoice.updated', 'Invoice', d._id, `Updated invoice ${d.invoiceNo}`, { team: d.team }); emit('payment:updated', d); },
  onDelete: (d) => emit('payment:updated', d),
}));

const PPOP = [{ path: 'invoice', select: 'invoiceNo total' }, { path: 'customer', select: 'name' }, { path: 'recordedBy', select: 'name' }];
async function guardAmount(inv, amount, excludeId) {
  const others = await Payment.find({ invoice: inv._id, status: 'Success', _id: { $ne: excludeId } });
  if (others.reduce((s, p) => s + p.amount, 0) + Number(amount) > inv.total) throw httpErr(400, 'Payment exceeds the outstanding balance');
}
R.use('/payments', crud({
  Model: Payment, kind: 'payment', populate: PPOP, search: ['txnRef'], filters: ['status', 'invoice', 'method', 'owner', 'team'], dateField: 'paymentDate',
  create: {
    build: async (req) => {
      const inv = await Invoice.findOne({ $and: [{ _id: req.body.invoice }, scopeFor(req.user, 'invoice')] }); if (!inv) throw httpErr(404, 'Invoice not found');
      // Sales Executives can only log a payment update; staff must verify it (no gateway is integrated).
      const status = req.user.role === 'sales' ? 'Pending' : (['Pending', 'Success'].includes(req.body.status) ? req.body.status : 'Success');
      if (status === 'Success') await guardAmount(inv, req.body.amount);
      return { ...pick(req.body, ['amount', 'method', 'txnRef', 'paymentDate']), status, invoice: inv._id, customer: inv.customer, owner: inv.owner, team: inv.team, recordedBy: req.user._id };
    },
  },
  update: {
    roles: STAFF,
    apply: async (req, doc) => { Object.assign(doc, pick(req.body, ['amount', 'method', 'txnRef', 'paymentDate', 'status'])); if (doc.status === 'Success') await guardAmount(await Invoice.findById(doc.invoice), doc.amount, doc._id); },
  },
  onCreate: async (d, req) => { await recompute(d.invoice); await log(req.user, 'payment.created', 'Payment', d._id, `Recorded payment of ₹${d.amount} (${d.status})`, { team: d.team }); emit('payment:updated', d); },
  onUpdate: async (d, req, b) => { await recompute(d.invoice); await log(req.user, 'payment.updated', 'Payment', d._id, `Payment ₹${d.amount} → ${d.status}`, { team: d.team, changes: diff(b, d, ['status', 'amount']) }); emit('payment:updated', d); },
}));
export default R;
