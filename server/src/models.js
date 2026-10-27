import mongoose from 'mongoose';
import { normPhone, normEmail } from './util.js';
const { Schema, model } = mongoose;
const ref = (r, o = {}) => ({ type: Schema.Types.ObjectId, ref: r, default: null, ...o });
const T = { timestamps: true };

export const LEAD_STATUSES = ['New', 'Contacted', 'Interested', 'Follow-up', 'Qualified', 'Admission in Progress', 'Converted', 'Lost'];
export const PRIORITIES = ['Low', 'Medium', 'High'];
export const TASK_STATUSES = ['To Do', 'In Progress', 'Completed', 'Cancelled'];
export const ADMISSION_STAGES = ['Enquiry', 'Counselling', 'Registered', 'Enrolled', 'Completed', 'Dropped'];
export const ADMISSION_STATUSES = ['Pending', 'Confirmed', 'Cancelled'];
export const CUSTOMER_ADM = ['Not Started', 'In Progress', 'Admitted', 'Dropped'];
export const INVOICE_STATUSES = ['Pending', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled', 'Failed', 'Refunded'];
export const PAY_STATUSES = ['Success', 'Pending', 'Partially Paid', 'Paid', 'Failed', 'Refunded', 'Cancelled'];
export const METHODS = ['UPI', 'Cash', 'Bank Transfer', 'Card', 'Other', 'Cheque', 'Online'];
export const PAYMENT_PLANS = ['One-Time Payment', 'Monthly EMI', 'Custom Installments'];

const hide = { toJSON: { transform: (d, r) => { delete r.passwordHash; delete r.tokenVersion; delete r.__v; return r; } } };

const Counter = model('Counter', new Schema({ _id: String, seq: { type: Number, default: 0 } }));
export const nextSeq = async (k) => (await Counter.findByIdAndUpdate(k, { $inc: { seq: 1 } }, { new: true, upsert: true })).seq;
export const nextInvoiceNo = async () => {
  const year = new Date().getFullYear();
  const seq = await nextSeq(`inv_${year}`);
  return `EFTS-INV-${year}-${String(seq).padStart(3, '0')}`;
};

export const User = model('User', new Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, match: [/^\S+@\S+\.\S+$/, 'Invalid email'] },
  phone: { type: String, trim: true },
  avatar: { type: String, default: null },
  passwordHash: { type: String, required: true, select: false },
  plainPassword: { type: String, default: '' },
  role: { type: String, enum: ['superadmin', 'admin', 'sales'], required: true, index: true },
  team: ref('Team', { index: true }),
  active: { type: Boolean, default: true },
  mustChangePassword: { type: Boolean, default: true },
  lastLogin: Date,
  tokenVersion: { type: Number, default: 0 },
}, { ...T, ...hide }));

export const Team = model('Team', new Schema({
  name: { type: String, required: true, unique: true, trim: true, maxlength: 80 },
  admin: ref('User'),
  members: [ref('User', { default: undefined })],
  history: [{ user: ref('User'), from: ref('Team'), to: ref('Team'), by: ref('User'), at: { type: Date, default: Date.now } }],
}, T));

export const Course = model('Course', new Schema({
  name: { type: String, required: true, unique: true, trim: true },
  fee: { type: Number, default: 0, min: 0 },
  duration: String,
  description: String,
  active: { type: Boolean, default: true },
}, T));

const leadSchema = new Schema({
  leadId: { type: String, unique: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  phone: { type: String, required: true, trim: true, match: [/^[+\d][\d\s-]{6,}$/, 'Invalid phone number'] },
  email: { type: String, trim: true, lowercase: true, match: [/^\S+@\S+\.\S+$/, 'Invalid email'] },
  course: ref('Course'),
  source: { type: String, trim: true, default: 'Direct' },
  team: ref('Team', { index: true }),
  admin: ref('User'),
  assignedTo: ref('User', { index: true }),
  status: { type: String, enum: LEAD_STATUSES, default: 'New', index: true },
  priority: { type: String, enum: PRIORITIES, default: 'Medium' },
  nextFollowUp: Date,
  notes: { type: String, maxlength: 2000 },
  createdBy: ref('User'),
  customer: ref('Customer'),
  history: [{ type: { type: String }, from: ref('User'), to: ref('User'), team: ref('Team'), by: ref('User'), at: { type: Date, default: Date.now } }],
  followUps: [{ note: String, date: { type: Date, default: Date.now }, by: ref('User'), next: Date }],
}, T);
leadSchema.index({ team: 1, status: 1 });
export const Lead = model('Lead', leadSchema);

export const Task = model('Task', new Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, maxlength: 2000 },
  assignee: ref('User', { index: true }),
  createdBy: ref('User'),
  team: ref('Team', { index: true }),
  lead: ref('Lead'),
  customer: ref('Customer'),
  priority: { type: String, enum: PRIORITIES, default: 'Medium' },
  dueDate: Date,
  status: { type: String, enum: TASK_STATUSES, default: 'To Do', index: true },
  completedAt: Date,
}, T));

const customerSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  phone: { type: String, required: true, trim: true, match: [/^[+\d][\d\s-]{6,}$/, 'Invalid phone number'] },
  phoneNorm: { type: String, unique: true, sparse: true },
  email: { type: String, trim: true, lowercase: true, match: [/^\S+@\S+\.\S+$/, 'Invalid email'] },
  emailNorm: { type: String, unique: true, sparse: true },
  course: ref('Course'),
  owner: ref('User', { index: true }),
  team: ref('Team', { index: true }),
  createdBy: ref('User'),
  lead: ref('Lead'),
  admissionStatus: { type: String, enum: CUSTOMER_ADM, default: 'Not Started' },
  notes: { type: String, maxlength: 2000 },
  history: [{ by: ref('User'), at: { type: Date, default: Date.now }, changes: [{ field: String, from: String, to: String }] }],
}, T);
customerSchema.pre('validate', function () {
  this.phoneNorm = normPhone(this.phone) || undefined;
  this.emailNorm = normEmail(this.email) || undefined;
});
export const Customer = model('Customer', customerSchema);

export const Admission = model('Admission', new Schema({
  customer: ref('Customer', { required: true, index: true }),
  course: ref('Course', { required: true }),
  mode: { type: String, enum: ['Online', 'Offline'], default: 'Online' },
  stage: { type: String, enum: ADMISSION_STAGES, default: 'Enquiry' },
  status: { type: String, enum: ADMISSION_STATUSES, default: 'Pending' },
  admissionDate: Date,
  fee: { type: Number, default: 0, min: 0 },
  owner: ref('User', { index: true }),
  team: ref('Team', { index: true }),
}, T));

const invoiceSchema = new Schema({
  invoiceNo: { type: String, unique: true },
  invoiceDate: { type: Date, default: Date.now },
  customer: ref('Customer', { required: false, index: true }),
  customerName: { type: String, trim: true },
  customerEmail: { type: String, trim: true },
  customerPhone: { type: String, trim: true },
  course: ref('Course'),
  programName: { type: String, trim: true },
  admission: ref('Admission'),
  mode: { type: String, enum: ['Online', 'Offline'], default: 'Online' },
  invoiceType: { type: String, enum: ['Registration', 'Payment', 'Manual'], default: 'Payment' },
  description: { type: String, trim: true },
  paymentMode: { type: String, default: 'UPI' },
  paymentPlan: { type: String, enum: ['One-Time Payment', 'Monthly EMI', 'Custom Installments'], default: 'One-Time Payment' },
  totalInstallments: { type: Number, default: 1, min: 1 },
  currentInstallment: { type: Number, default: 1 },
  installmentAmount: { type: Number, default: 0 },
  registrationFee: { type: Number, default: 0, min: 0 },
  totalInternshipFee: { type: Number, default: 0, min: 0 },
  total: { type: Number, required: true, min: 0 },
  paid: { type: Number, default: 0, min: 0 },
  balance: { type: Number, default: 0 },
  amountInWords: { type: String, trim: true },
  status: { type: String, enum: INVOICE_STATUSES, default: 'Pending' },
  dueDate: Date,
  paymentDate: Date,
  method: String,
  txnRef: String,
  notes: { type: String, maxlength: 2000 },
  paymentRows: [
    {
      sNo: Number,
      description: String,
      date: { type: Date, default: Date.now },
      emiNumber: String,
      mode: String,
      amount: Number,
      status: { type: String, default: 'Success' },
      txnRef: String,
      paymentId: ref('Payment'),
    }
  ],
  emailStatus: { type: String, enum: ['Not Sent', 'Sent', 'Failed'], default: 'Not Sent' },
  emailSentAt: Date,
  emailRecipient: String,
  emailMessageId: String,
  emailError: String,
  emailedBy: ref('User'),
  owner: ref('User', { index: true }),
  team: ref('Team', { index: true }),
  createdBy: ref('User'),
}, T);
export const Invoice = model('Invoice', invoiceSchema);

export const Payment = model('Payment', new Schema({
  invoice: ref('Invoice', { required: true, index: true }),
  customer: ref('Customer'),
  description: { type: String, trim: true },
  amount: { type: Number, required: true, min: 1 },
  method: { type: String, enum: METHODS, default: 'UPI' },
  emiNumber: { type: String, trim: true },
  txnRef: { type: String, trim: true },
  paymentDate: { type: Date, default: Date.now },
  dueDate: Date,
  status: { type: String, enum: PAY_STATUSES, default: 'Success' },
  owner: ref('User', { index: true }),
  team: ref('Team', { index: true }),
  recordedBy: ref('User'),
}, T));

const logSchema = new Schema({
  actor: ref('User', { index: true }), actorName: String, action: String, entity: String,
  entityId: { type: Schema.Types.ObjectId, index: true }, summary: String,
  changes: [{ field: String, from: String, to: String }], team: ref('Team', { index: true }),
}, T);
logSchema.index({ createdAt: -1 });
export const ActivityLog = model('ActivityLog', logSchema);

const notifSchema = new Schema({
  recipient: ref('User', { required: true, index: true }),
  type: { type: String, required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  data: { type: Schema.Types.Mixed, default: {} },
  read: { type: Boolean, default: false, index: true },
}, T);
notifSchema.index({ recipient: 1, read: 1 });
export const Notification = model('Notification', notifSchema);
