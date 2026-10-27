import { Router } from 'express';
import { Course, Admission, Invoice, Payment, Customer, nextSeq, nextInvoiceNo } from '../models.js';
import { crud } from './crud.js';
import { scopeFor } from '../scope.js';
import { pick, diff, httpErr, amountToIndianWords } from '../util.js';
import { requireRole } from '../middleware.js';
import { emit } from '../realtime.js';
import { log } from '../services/activity.js';
import { sendInvoiceMail, isEmailConfigured } from '../services/mailer.js';
import { isGmailConfigured, getAuthUrl, exchangeCode } from '../services/gmail.js';
import { generateInvoicePdf } from '../services/invoicePdf.js';

const R = Router();
const SUPER = ['superadmin'], STAFF = ['superadmin', 'admin'], ALL_ROLES = ['superadmin', 'admin', 'sales'];

/* ---------- Courses ---------- */
R.use('/courses', crud({
  Model: Course, kind: 'course', search: ['name'], filters: ['active'], sort: 'name',
  create: { roles: STAFF, build: async (req) => pick(req.body, ['name', 'fee', 'duration', 'description', 'active']) },
  update: { roles: STAFF, apply: async (req, doc) => Object.assign(doc, pick(req.body, ['name', 'fee', 'duration', 'description', 'active'])) },
  remove: { roles: STAFF, check: async (doc) => { if (await Admission.exists({ course: doc._id })) throw httpErr(409, 'Course has admissions; deactivate it instead'); } },
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
async function ensureRegistrationInvoice(adm, user) {
  if (adm.stage !== 'Registered') return;
  if (await Invoice.exists({ admission: adm._id, invoiceType: 'Registration' })) return;
  const customer = await Customer.findById(adm.customer);
  if (!customer) return;
  const course = await Course.findById(adm.course);
  const mode = adm.mode || 'Online';
  const totalInternshipFee = mode === 'Offline' ? 30000 : 20000;
  const registrationFee = 2000;
  const invoiceNo = await nextInvoiceNo();
  const inv = await Invoice.create({
    invoiceNo,
    customer: customer._id,
    customerName: customer.name,
    customerEmail: customer.email,
    customerPhone: customer.phone,
    course: course?._id || adm.course,
    programName: course?.name || 'Internship Program',
    admission: adm._id,
    mode,
    invoiceType: 'Registration',
    registrationFee,
    totalInternshipFee,
    total: registrationFee,
    paid: 0,
    balance: registrationFee,
    amountInWords: amountToIndianWords(registrationFee),
    status: 'Pending',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    owner: customer.owner || adm.owner || user?._id,
    team: customer.team || adm.team,
    createdBy: user?._id,
  });
  if (user) await log(user, 'invoice.auto_created', 'Invoice', inv._id, `Auto-created registration invoice ${inv.invoiceNo}`, { team: inv.team });
  emit('payment:updated', inv);
}
R.use('/admissions', crud({
  Model: Admission, kind: 'admission', populate: APOP, filters: ['stage', 'status', 'course', 'owner', 'team'], dateField: 'admissionDate',
  create: {
    build: async (req) => {
      const c = await Customer.findOne({ $and: [{ _id: req.body.customer }, scopeFor(req.user, 'customer')] }); if (!c) throw httpErr(404, 'Customer not found');
      const course = await Course.findById(req.body.course); if (!course) throw httpErr(400, 'Select a course');
      if (await Admission.exists({ customer: c._id, course: course._id, status: { $ne: 'Cancelled' } })) throw httpErr(409, 'This customer already has an admission for this course');
      return { ...pick(req.body, ['stage', 'status', 'admissionDate', 'mode']), customer: c._id, course: course._id, fee: req.body.fee ?? course.fee, owner: c.owner, team: c.team };
    },
  },
  update: {
    apply: async (req, doc) => {
      Object.assign(doc, pick(req.body, ['stage', 'status', 'admissionDate', 'fee', 'mode']));
      if (doc.status === 'Confirmed' && !doc.admissionDate) doc.admissionDate = new Date();
    },
  },
  remove: { roles: STAFF, check: async (doc) => { if (await Invoice.exists({ admission: doc._id })) throw httpErr(409, 'Admission has invoices'); } },
  onCreate: async (d, req) => { await syncCustomer(d); await ensureRegistrationInvoice(d, req.user); await log(req.user, 'admission.created', 'Admission', d._id, 'Created admission record', { team: d.team }); emit('admission:updated', d); },
  onUpdate: async (d, req, b) => { await syncCustomer(d); await ensureRegistrationInvoice(d, req.user); await log(req.user, 'admission.updated', 'Admission', d._id, `Admission → ${d.stage} / ${d.status}`, { team: d.team, changes: diff(b, d, ['stage', 'status', 'fee', 'mode']) }); emit('admission:updated', d); },
  onDelete: (d) => emit('admission:updated', d),
}));

/* ---------- Invoices & Payments Helpers ---------- */
async function recompute(invoiceId) {
  const inv = await Invoice.findById(invoiceId); if (!inv) return null;
  const pays = await Payment.find({ invoice: inv._id }).sort('paymentDate');
  const ok = pays.filter((p) => p.status === 'Success' || p.status === 'Paid');
  inv.paid = ok.reduce((s, p) => s + p.amount, 0);
  inv.balance = Math.max(0, (inv.total || 0) - inv.paid);

  if (inv.status !== 'Cancelled') {
    const isOverdue = inv.dueDate && new Date(inv.dueDate) < new Date() && inv.balance > 0;
    if (inv.paid >= (inv.total || 0) && (inv.total || 0) > 0) {
      inv.status = 'Paid';
    } else if (inv.paid > 0) {
      inv.status = isOverdue ? 'Overdue' : 'Partially Paid';
    } else if (isOverdue) {
      inv.status = 'Overdue';
    } else {
      inv.status = 'Pending';
    }
  }

  const last = ok[ok.length - 1];
  if (last) {
    inv.paymentDate = last.paymentDate || inv.paymentDate;
    inv.method = last.method || inv.method;
    inv.paymentMode = last.method || inv.paymentMode;
    inv.txnRef = last.txnRef || inv.txnRef;
  }
  inv.amountInWords = amountToIndianWords(inv.total);
  await inv.save();
  return inv;
}

const IPOP = [
  { path: 'customer', select: 'name phone email' },
  { path: 'course', select: 'name fee' },
  { path: 'admission', select: 'stage status mode fee' },
  { path: 'owner', select: 'name' },
  { path: 'createdBy', select: 'name' }
];

/* 1. Preview Next Sequential Invoice Number */
R.get('/invoices/next-number', async (req, res) => {
  const year = new Date().getFullYear();
  const Counter = Invoice.db.model('Counter');
  const counterDoc = await Counter.findById(`inv_${year}`);
  const nextSeqNum = (counterDoc?.seq || 0) + 1;
  const invoiceNo = `EFTS-INV-${year}-${String(nextSeqNum).padStart(3, '0')}`;
  res.json({ invoiceNo, year, nextSeq: nextSeqNum });
});

/* 2. Customer Autofill helper */
R.get('/invoices/customer-info/:customerId', async (req, res) => {
  const c = await Customer.findOne({ $and: [{ _id: req.params.customerId }, scopeFor(req.user, 'customer')] }).populate('course');
  if (!c) throw httpErr(404, 'Customer not found');

  const adm = await Admission.findOne({ customer: c._id, status: { $ne: 'Cancelled' } }).populate('course').sort('-createdAt');
  const existingInvoices = await Invoice.find({ customer: c._id });
  const totalInvoiced = existingInvoices.reduce((s, i) => s + (i.total || 0), 0);
  const totalPaid = existingInvoices.reduce((s, i) => s + (i.paid || 0), 0);
  const outstandingBalance = Math.max(0, totalInvoiced - totalPaid);

  const course = adm?.course || c.course;
  const programName = course?.name || '';
  const mode = adm?.mode || 'Online';
  const totalProgramFee = mode === 'Offline' ? 30000 : 20000;
  const registrationFee = mode === 'Offline' ? 3000 : 2000;

  // Retrieve payment history for this customer
  const payments = await Payment.find({ customer: c._id }).sort('-paymentDate').limit(10);

  res.json({
    customer: {
      _id: c._id,
      name: c.name,
      email: c.email || '',
      phone: c.phone || '',
    },
    admission: adm ? { _id: adm._id, mode: adm.mode, stage: adm.stage, status: adm.status, fee: adm.fee } : null,
    course: course ? { _id: course._id, name: course.name, fee: course.fee } : null,
    mode,
    registrationFee,
    programName,
    totalProgramFee,
    totalInvoiced,
    totalPaid,
    outstandingBalance,
    payments,
  });
});

/* 3. Upgraded Invoice Creation */
R.post('/invoices', requireRole(...ALL_ROLES), async (req, res) => {
  let customerDoc = null;
  if (req.body.customer) {
    customerDoc = await Customer.findOne({ $and: [{ _id: req.body.customer }, scopeFor(req.user, 'customer')] });
    if (!customerDoc && req.user.role !== 'sales') {
      customerDoc = await Customer.findById(req.body.customer);
    }
  }

  const customerName = req.body.customerName || customerDoc?.name || 'Customer';
  const customerEmail = req.body.customerEmail || customerDoc?.email || '';
  const customerPhone = req.body.customerPhone || customerDoc?.phone || '';

  // Calculate dynamic invoice number if not already unique
  let invoiceNo = req.body.invoiceNo?.trim();
  if (!invoiceNo || invoiceNo.includes('—') || (await Invoice.exists({ invoiceNo }))) {
    invoiceNo = await nextInvoiceNo();
  }

  const mode = req.body.mode === 'Offline' ? 'Offline' : 'Online';
  const totalInternshipFee = req.body.totalInternshipFee != null ? Number(req.body.totalInternshipFee) : (mode === 'Offline' ? 30000 : 20000);
  const total = req.body.total != null ? Number(req.body.total) : (req.body.registrationFee != null ? Number(req.body.registrationFee) : totalInternshipFee);

  // Process payment rows if submitted
  const rawRows = Array.isArray(req.body.paymentRows) ? req.body.paymentRows : [];
  let calculatedPaid = 0;
  const sanitizedRows = [];

  rawRows.forEach((r, idx) => {
    const amt = Number(r.amount) || 0;
    if (amt > 0) {
      const isSuccess = r.status === 'Success' || r.status === 'Paid';
      if (isSuccess) calculatedPaid += amt;
      sanitizedRows.push({
        sNo: r.sNo || idx + 1,
        description: r.description || `${req.body.programName || 'Internship'} – EMI ${r.emiNumber || (idx + 1)} - ${r.mode || req.body.paymentMode || 'UPI'}`,
        date: r.date ? new Date(r.date) : new Date(),
        emiNumber: String(r.emiNumber || (idx + 1)),
        mode: r.mode || req.body.paymentMode || 'UPI',
        amount: amt,
        status: isSuccess ? 'Paid' : (r.status || 'Success'),
        txnRef: r.txnRef || '',
      });
    }
  });

  // Received amount check: never allow received to exceed total without advance-payment workflow
  const paid = calculatedPaid > 0 ? calculatedPaid : (Number(req.body.paid) || 0);
  if (paid > total && !req.body.allowAdvance) {
    throw httpErr(400, `Received amount (₹${paid}) cannot exceed total invoice amount (₹${total})`);
  }

  const balance = Math.max(0, total - paid);
  const dueDate = req.body.dueDate ? new Date(req.body.dueDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const isOverdue = dueDate < new Date() && balance > 0;

  let status = req.body.status || 'Pending';
  if (status !== 'Cancelled') {
    if (paid >= total && total > 0) status = 'Paid';
    else if (paid > 0) status = isOverdue ? 'Overdue' : 'Partially Paid';
    else if (isOverdue) status = 'Overdue';
    else status = 'Pending';
  }

  const amountInWords = req.body.amountInWords || amountToIndianWords(total);

  const inv = await Invoice.create({
    invoiceNo,
    invoiceDate: req.body.invoiceDate ? new Date(req.body.invoiceDate) : new Date(),
    customer: customerDoc?._id || (req.body.customer ? req.body.customer : undefined),
    customerName,
    customerEmail,
    customerPhone,
    course: req.body.course || customerDoc?.course || undefined,
    programName: req.body.programName || '',
    admission: req.body.admission || undefined,
    mode,
    invoiceType: req.body.invoiceType || 'Payment',
    description: req.body.description || `${req.body.programName || 'Internship Program'} – ${req.body.paymentMode || 'UPI'}`,
    paymentMode: req.body.paymentMode || 'UPI',
    paymentPlan: req.body.paymentPlan || 'One-Time Payment',
    totalInstallments: Number(req.body.totalInstallments) || 1,
    currentInstallment: Number(req.body.currentInstallment) || 1,
    installmentAmount: Number(req.body.installmentAmount) || 0,
    registrationFee: Number(req.body.registrationFee) || 0,
    totalInternshipFee,
    total,
    paid,
    balance,
    amountInWords,
    status,
    dueDate,
    paymentDate: req.body.paymentDate ? new Date(req.body.paymentDate) : (sanitizedRows[0]?.date || new Date()),
    method: req.body.paymentMode || 'UPI',
    txnRef: req.body.txnRef || sanitizedRows[0]?.txnRef || '',
    notes: req.body.notes || '',
    paymentRows: sanitizedRows,
    owner: customerDoc?.owner || req.user._id,
    team: customerDoc?.team || req.user.team,
    createdBy: req.user._id,
  });

  // Save corresponding Payment records in MongoDB to ensure zero data duplication
  if (sanitizedRows.length > 0) {
    for (const row of inv.paymentRows) {
      const pDoc = await Payment.create({
        invoice: inv._id,
        customer: inv.customer,
        description: row.description,
        amount: row.amount,
        method: row.mode || inv.paymentMode || 'UPI',
        emiNumber: row.emiNumber,
        txnRef: row.txnRef,
        paymentDate: row.date,
        status: row.status === 'Paid' ? 'Success' : row.status,
        owner: inv.owner,
        team: inv.team,
        recordedBy: req.user._id,
      });
      row.paymentId = pDoc._id;
    }
    await inv.save();
  }

  await log(req.user, 'invoice.created', 'Invoice', inv._id, `Created invoice ${inv.invoiceNo} (₹${inv.total})`, { team: inv.team });
  emit('payment:updated', inv);
  res.status(201).json(await Invoice.findById(inv._id).populate(IPOP));
});

/* 4. Upgraded Invoice Update */
R.put('/invoices/:id', requireRole(...ALL_ROLES), async (req, res) => {
  const inv = await Invoice.findOne({ $and: [{ _id: req.params.id }, scopeFor(req.user, 'invoice')] });
  if (!inv) throw httpErr(404, 'Invoice not found');

  if (req.body.customerName) inv.customerName = req.body.customerName;
  if (req.body.customerEmail !== undefined) inv.customerEmail = req.body.customerEmail;
  if (req.body.customerPhone !== undefined) inv.customerPhone = req.body.customerPhone;
  if (req.body.programName !== undefined) inv.programName = req.body.programName;
  if (req.body.description !== undefined) inv.description = req.body.description;
  if (req.body.paymentMode) inv.paymentMode = req.body.paymentMode;
  if (req.body.paymentPlan) inv.paymentPlan = req.body.paymentPlan;
  if (req.body.totalInstallments != null) inv.totalInstallments = Number(req.body.totalInstallments);
  if (req.body.currentInstallment != null) inv.currentInstallment = Number(req.body.currentInstallment);
  if (req.body.installmentAmount != null) inv.installmentAmount = Number(req.body.installmentAmount);
  if (req.body.notes !== undefined) inv.notes = req.body.notes;
  if (req.body.dueDate) inv.dueDate = new Date(req.body.dueDate);
  if (req.body.paymentDate) inv.paymentDate = new Date(req.body.paymentDate);

  if (req.body.total != null) {
    inv.total = Number(req.body.total);
    inv.amountInWords = amountToIndianWords(inv.total);
  }

  // Update payment rows if supplied
  if (Array.isArray(req.body.paymentRows)) {
    const updatedRows = [];
    for (let idx = 0; idx < req.body.paymentRows.length; idx++) {
      const r = req.body.paymentRows[idx];
      const amt = Number(r.amount) || 0;
      if (amt > 0) {
        const isSuccess = r.status === 'Paid' || r.status === 'Success';
        let pId = r.paymentId;
        if (!pId) {
          const pDoc = await Payment.create({
            invoice: inv._id,
            customer: inv.customer,
            description: r.description || `${inv.programName} – EMI ${r.emiNumber || (idx + 1)} - ${r.mode || inv.paymentMode}`,
            amount: amt,
            method: r.mode || inv.paymentMode,
            emiNumber: String(r.emiNumber || (idx + 1)),
            txnRef: r.txnRef || '',
            paymentDate: r.date ? new Date(r.date) : new Date(),
            status: isSuccess ? 'Success' : (r.status || 'Success'),
            owner: inv.owner,
            team: inv.team,
            recordedBy: req.user._id,
          });
          pId = pDoc._id;
        } else {
          await Payment.findByIdAndUpdate(pId, {
            description: r.description,
            amount: amt,
            method: r.mode || inv.paymentMode,
            emiNumber: String(r.emiNumber || (idx + 1)),
            txnRef: r.txnRef || '',
            paymentDate: r.date ? new Date(r.date) : new Date(),
            status: isSuccess ? 'Success' : (r.status || 'Success'),
          });
        }
        updatedRows.push({
          sNo: r.sNo || idx + 1,
          description: r.description,
          date: r.date ? new Date(r.date) : new Date(),
          emiNumber: String(r.emiNumber || (idx + 1)),
          mode: r.mode || inv.paymentMode,
          amount: amt,
          status: isSuccess ? 'Paid' : (r.status || 'Success'),
          txnRef: r.txnRef || '',
          paymentId: pId,
        });
      }
    }
    inv.paymentRows = updatedRows;
  }

  await inv.save();
  await recompute(inv._id);
  await log(req.user, 'invoice.updated', 'Invoice', inv._id, `Updated invoice ${inv.invoiceNo}`, { team: inv.team });
  emit('payment:updated', inv);
  res.json(await Invoice.findById(inv._id).populate(IPOP));
});

/* List and Standard Scoped Invoice Routes */
R.use('/invoices', crud({
  Model: Invoice, kind: 'invoice', populate: IPOP, search: ['invoiceNo', 'customerName', 'programName'], filters: ['status', 'course', 'owner', 'team', 'customer'],
  remove: {
    roles: STAFF,
    check: async (doc) => {
      // Cascade delete all payment records associated with this invoice
      await Payment.deleteMany({ invoice: doc._id });
    },
  },
  onDelete: async (d, req) => {
    if (req?.user) {
      await log(req.user, 'invoice.deleted', 'Invoice', d._id, `Deleted invoice ${d.invoiceNo}`, { team: d.team });
    }
    emit('payment:updated', d);
  },
}));

/* 5. PDF Generation & Download */
R.get('/invoices/:id/pdf', async (req, res) => {
  const inv = await Invoice.findOne({ $and: [{ _id: req.params.id }, scopeFor(req.user, 'invoice')] }).populate(IPOP);
  if (!inv) throw httpErr(404, 'Invoice not found');

  // If invoice has payment records in Payment collection, ensure paymentRows is populated
  const pays = await Payment.find({ invoice: inv._id }).sort('paymentDate');
  if ((!inv.paymentRows || inv.paymentRows.length === 0) && pays.length > 0) {
    inv.paymentRows = pays.map((p, idx) => ({
      sNo: idx + 1,
      description: p.description || `${inv.programName || inv.course?.name || 'Internship'} – EMI ${p.emiNumber || (idx + 1)} - ${p.method || 'UPI'}`,
      date: p.paymentDate,
      emiNumber: p.emiNumber || String(idx + 1),
      mode: p.method,
      amount: p.amount,
      status: p.status === 'Success' ? 'Paid' : p.status,
      txnRef: p.txnRef,
      paymentId: p._id,
    }));
  }

  const pdf = await generateInvoicePdf(inv);
  const inline = req.query.inline === 'true';
  const disposition = inline ? 'inline' : 'attachment';

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${disposition}; filename="${inv.invoiceNo || 'invoice'}.pdf"`);
  res.send(pdf);
});

/* 6. Email Invoice to Customer with attached original PDF */
const sendingLocks = new Set();
R.post('/invoices/:id/send-email', async (req, res) => {
  const inv = await Invoice.findOne({ $and: [{ _id: req.params.id }, scopeFor(req.user, 'invoice')] }).populate(IPOP);
  if (!inv) throw httpErr(404, 'Invoice not found');
  if (sendingLocks.has(String(inv._id))) throw httpErr(409, 'Email send already in progress');

  if (!isEmailConfigured()) {
    inv.emailStatus = 'Failed';
    inv.emailError = 'Email service not configured. Configure SMTP credentials (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS) or Gmail in server/.env';
    await inv.save().catch(() => {});
    throw httpErr(503, 'Email service is not configured. Please configure SMTP credentials (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS) or connect Gmail in server/.env.');
  }

  sendingLocks.add(String(inv._id));
  try {
    const recipient = req.body?.recipient || inv.customerEmail || inv.customer?.email || inv.emailRecipient;
    if (!recipient) throw httpErr(400, 'Customer email address is not available');

    // Make sure payment rows are hydrated for PDF
    const pays = await Payment.find({ invoice: inv._id }).sort('paymentDate');
    if ((!inv.paymentRows || inv.paymentRows.length === 0) && pays.length > 0) {
      inv.paymentRows = pays.map((p, idx) => ({
        sNo: idx + 1,
        description: p.description || `${inv.programName || inv.course?.name || 'Internship'} – EMI ${p.emiNumber || (idx + 1)} - ${p.method || 'UPI'}`,
        date: p.paymentDate,
        emiNumber: p.emiNumber || String(idx + 1),
        mode: p.method,
        amount: p.amount,
        status: p.status === 'Success' ? 'Paid' : p.status,
        txnRef: p.txnRef,
        paymentId: p._id,
      }));
    }

    const pdf = await generateInvoicePdf(inv);
    const subject = req.body?.subject || `Payment Invoice ${inv.invoiceNo} – Eco Friendly Tech Solutions`;
    const custName = inv.customerName || inv.customer?.name || 'Valued Customer';
    const text = req.body?.message || `Dear ${custName},\n\nPlease find attached your payment invoice (${inv.invoiceNo}) from Eco Friendly Tech Solutions.\n\nSummary:\n- Invoice No: ${inv.invoiceNo}\n- Date: ${new Date(inv.invoiceDate || Date.now()).toLocaleDateString('en-IN')}\n- Total Amount: ₹${Number(inv.total || 0).toLocaleString('en-IN')}\n- Amount Paid: ₹${Number(inv.paid || 0).toLocaleString('en-IN')}\n- Balance: ₹${Number(inv.balance || 0).toLocaleString('en-IN')}\n- Payment Status: ${inv.status}\n\nThank you for choosing Eco Friendly Tech Solutions.\n\nWarm regards,\nEco Friendly Tech Solutions\nEducation • Technology • Career Development\nWebsite: www.ecofriendlytechsolutions.tech\nEmail: info@eco-friendly.tech\nPhone: +91 9043 538 838`;

    const result = await sendInvoiceMail({
      to: recipient,
      subject,
      text,
      pdfBuffer: pdf,
      filename: `${inv.invoiceNo}.pdf`,
    });

    inv.emailStatus = 'Sent';
    inv.emailSentAt = new Date();
    inv.emailRecipient = recipient;
    inv.emailMessageId = result.messageId;
    inv.emailError = null;
    inv.emailedBy = req.user._id;
    await inv.save();

    await log(req.user, 'invoice.emailed', 'Invoice', inv._id, `Emailed invoice ${inv.invoiceNo} to ${recipient} via ${result.provider}`, { team: inv.team });
    emit('payment:updated', inv);
    res.json({ ok: true, messageId: result.messageId, recipient, provider: result.provider });
  } catch (e) {
    inv.emailStatus = 'Failed';
    inv.emailError = e.message;
    await inv.save().catch(() => {});
    throw e;
  } finally {
    sendingLocks.delete(String(inv._id));
  }
});

/* Gmail OAuth Status (preserved for compatibility) */
R.get('/gmail/status', (req, res) => {
  let authUrl = null;
  try { if (!isGmailConfigured()) authUrl = getAuthUrl(); } catch (e) { console.error('Gmail auth URL generation failed:', e.message); }
  res.json({ configured: isGmailConfigured(), emailConfigured: isEmailConfigured(), authUrl });
});

R.get('/gmail/auth-url', requireRole('superadmin', 'admin'), (req, res) => {
  res.json({ url: getAuthUrl() });
});

/* ---------- Payments CRUD ---------- */
const PPOP = [{ path: 'invoice', select: 'invoiceNo total customerName programName' }, { path: 'customer', select: 'name phone' }, { path: 'recordedBy', select: 'name' }];
async function guardAmount(inv, amount, excludeId) {
  const others = await Payment.find({ invoice: inv._id, status: 'Success', _id: { $ne: excludeId } });
  if (others.reduce((s, p) => s + p.amount, 0) + Number(amount) > inv.total) throw httpErr(400, 'Payment exceeds the outstanding balance');
}

R.use('/payments', crud({
  Model: Payment, kind: 'payment', populate: PPOP, search: ['txnRef', 'description'], filters: ['status', 'invoice', 'method', 'owner', 'team'], dateField: 'paymentDate',
  create: {
    build: async (req) => {
      const inv = await Invoice.findOne({ $and: [{ _id: req.body.invoice }, scopeFor(req.user, 'invoice')] }); if (!inv) throw httpErr(404, 'Invoice not found');
      const status = req.user.role === 'sales' ? 'Pending' : (['Pending', 'Success'].includes(req.body.status) ? req.body.status : 'Success');
      if (status === 'Success') await guardAmount(inv, req.body.amount);
      return {
        ...pick(req.body, ['amount', 'method', 'txnRef', 'paymentDate', 'description', 'emiNumber']),
        status,
        invoice: inv._id,
        customer: inv.customer,
        owner: inv.owner,
        team: inv.team,
        recordedBy: req.user._id,
      };
    },
  },
  update: {
    roles: STAFF,
    apply: async (req, doc) => {
      Object.assign(doc, pick(req.body, ['amount', 'method', 'txnRef', 'paymentDate', 'status', 'description', 'emiNumber']));
      if (doc.status === 'Success') await guardAmount(await Invoice.findById(doc.invoice), doc.amount, doc._id);
    },
  },
  remove: { roles: STAFF },
  onCreate: async (d, req) => { await recompute(d.invoice); await log(req.user, 'payment.created', 'Payment', d._id, `Recorded payment of ₹${d.amount} (${d.status})`, { team: d.team }); emit('payment:updated', d); },
  onUpdate: async (d, req, b) => { await recompute(d.invoice); await log(req.user, 'payment.updated', 'Payment', d._id, `Payment ₹${d.amount} → ${d.status}`, { team: d.team, changes: diff(b, d, ['status', 'amount']) }); emit('payment:updated', d); },
  onDelete: async (d, req) => { await recompute(d.invoice); if (req?.user) await log(req.user, 'payment.deleted', 'Payment', d._id, `Deleted payment of ₹${d.amount}`, { team: d.team }); emit('payment:updated', d); },
}));

export default R;
