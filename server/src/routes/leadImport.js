import { Router } from 'express';
import { Lead, Course, Notification, nextSeq, LEAD_STATUSES } from '../models.js';
import { requireRole } from '../middleware.js';
import { normPhone, normEmail, httpErr } from '../util.js';
import { emit } from '../realtime.js';
import { log } from '../services/activity.js';
import * as XLSX from 'xlsx';

const r = Router();

const COL_MAP = {
  name: ['name', 'lead name', 'student name', 'customer name', 'full name', 'lead'],
  phone: ['phone', 'phone number', 'mobile', 'mobile number', 'contact', 'contact number', 'ph', 'ph no', 'ph number', 'mobile no', 'contact no'],
  email: ['email', 'email address', 'mail', 'e-mail', 'gmail', 'gmail address', 'email id', 'gmail id'],
  address: ['address', 'actual address', 'student address', 'customer address', 'residential address', 'communication address', 'street address', 'permanent address', 'full address', 'addr'],
  company: ['company', 'company name', 'organization', 'organisation', 'org'],
  course: ['course', 'course interested', 'course interest', 'interested course', 'program', 'programme'],
  source: ['source', 'lead source', 'origin', 'referred by'],
  location: ['location', 'city', 'place', 'area', 'town', 'district', 'state'],
  notes: ['notes', 'note', 'remarks', 'comment', 'comments', 'description', 'remark'],
  nextFollowUp: ['follow-up date', 'follow up date', 'followup date', 'next follow up', 'next follow-up', 'follow up', 'followup', 'next followup'],
  status: ['status', 'lead status', 'current status'],
};

function mapHeader(h) {
  const low = String(h || '').toLowerCase().trim();
  for (const [field, aliases] of Object.entries(COL_MAP)) {
    if (aliases.includes(low)) return field;
  }
  return null;
}

function parseDate(v) {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const s = String(v).trim();
  if (!s) return null;
  // Try Excel numeric date serial
  if (/^\d+(\.\d+)?$/.test(s)) {
    try {
      const d = XLSX.SSF.parse_date_code(parseFloat(s));
      if (d) return new Date(d.y, d.m - 1, d.d);
    } catch { /* ignore */ }
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// GET /api/leads/import/template — download sample Excel template
r.get('/template', requireRole('superadmin'), (req, res) => {
  const headers = [
    'Lead Name', 'Phone Number', 'Email', 'Address', 'Company Name',
    'Course Interested', 'Lead Source', 'Location', 'Notes',
    'Follow-up Date', 'Lead Status',
  ];
  const sample1 = ['John Doe', '9876543210', 'john@example.com', '123 Main Street, Suite 400', 'ABC Corp', 'Web Development', 'Website', 'Mumbai', 'Interested in weekend classes', '2025-06-15', 'New'];
  const sample2 = ['Jane Smith', '8765432109', 'jane@example.com', '45 Park Avenue, Block C', '', 'Data Science', 'Referral', 'Delhi', '', '', 'Contacted'];
  const sample3 = ['Rahul Kumar', '9123456789', 'rahul@example.com', 'No. 12 Anna Salai, Chennai', 'Tech Solutions', 'Cloud Computing', 'Direct', 'Chennai', 'Call back tomorrow', '2025-06-20', 'RNR (Ring No Response)'];
  const ws = XLSX.utils.aoa_to_sheet([headers, sample1, sample2, sample3]);
  ws['!cols'] = headers.map(() => ({ wch: 22 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Leads Template');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="leads-import-template.xlsx"');
  res.send(buf);
});

// POST /api/leads/import/preview — parse file, return column mapping + preview rows
r.post('/preview', requireRole('superadmin'), async (req, res) => {
  const { data } = req.body;
  if (!data) throw httpErr(400, 'No file data received');

  let workbook;
  try {
    const buf = Buffer.from(data, 'base64');
    workbook = XLSX.read(buf, { type: 'buffer', cellDates: true });
  } catch {
    throw httpErr(400, 'Invalid file format. Please upload a valid .xlsx or .csv file');
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (!rows.length) throw httpErr(400, 'The file is empty');
  const headers = rows[0].map(String);
  const dataRows = rows.slice(1).filter((row) => row.some((c) => String(c || '').trim()));
  if (!dataRows.length) throw httpErr(400, 'No data rows found in the file');
  if (dataRows.length > 5000) throw httpErr(400, 'File too large — maximum 5000 rows per import');

  const fieldMap = {};
  headers.forEach((h, i) => {
    const f = mapHeader(h);
    if (f) fieldMap[i] = f;
  });

  const preview = dataRows.slice(0, 5).map((row, i) => {
    const obj = { _rowNum: i + 2 };
    Object.entries(fieldMap).forEach(([ci, field]) => {
      obj[field] = String(row[ci] || '').trim();
    });
    return obj;
  });

  const missingRequired = [];
  if (!Object.values(fieldMap).includes('name')) missingRequired.push('name');
  if (!Object.values(fieldMap).includes('phone')) missingRequired.push('phone');

  res.json({ totalRows: dataRows.length, headers, mappedColumns: fieldMap, preview, missingRequired });
});

// POST /api/leads/import — actually import leads
r.post('/', requireRole('superadmin'), async (req, res) => {
  const { data, skipDuplicates = true } = req.body;
  if (!data) throw httpErr(400, 'No file data received');

  let workbook;
  try {
    const buf = Buffer.from(data, 'base64');
    workbook = XLSX.read(buf, { type: 'buffer', cellDates: true });
  } catch {
    throw httpErr(400, 'Invalid file format');
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (rows.length < 2) throw httpErr(400, 'File has no data rows');

  const headers = rows[0].map(String);
  const fieldMap = {};
  headers.forEach((h, i) => {
    const f = mapHeader(h);
    if (f) fieldMap[i] = f;
  });

  const dataRows = rows.slice(1).filter((row) => row.some((c) => String(c || '').trim()));
  if (!dataRows.length) throw httpErr(400, 'No data rows found');
  if (dataRows.length > 5000) throw httpErr(400, 'Maximum 5000 rows per import');

  // Load active courses for matching
  const courses = await Course.find({ active: true }).select('name').lean();
  const courseMap = {};
  courses.forEach((c) => { courseMap[c.name.toLowerCase().trim()] = c._id; });

  // Pre-load all existing phones/emails for duplicate detection
  const existingPhones = new Set();
  const existingEmails = new Set();
  const allLeads = await Lead.find({}).select('phone email').lean();
  allLeads.forEach((l) => {
    if (l.phone) existingPhones.add(normPhone(l.phone));
    if (l.email) existingEmails.add(l.email.toLowerCase().trim());
  });

  const results = { imported: 0, duplicates: 0, failed: 0, errors: [] };
  const importedIds = [];
  const seenInFile = new Set();

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowNum = i + 2;
    const obj = {};
    Object.entries(fieldMap).forEach(([ci, field]) => {
      obj[field] = String(row[ci] || '').trim();
    });

    // Validate required fields
    if (!obj.name) {
      results.failed++;
      results.errors.push({ row: rowNum, field: 'name', message: 'Name is required' });
      continue;
    }
    if (!obj.phone) {
      results.failed++;
      results.errors.push({ row: rowNum, field: 'phone', message: 'Phone is required' });
      continue;
    }

    // Validate phone
    const cleanPhone = String(obj.phone).replace(/\D/g, '');
    if (cleanPhone.length < 7 || cleanPhone.length > 15) {
      results.failed++;
      results.errors.push({ row: rowNum, field: 'phone', message: `Invalid phone number: ${obj.phone}` });
      continue;
    }

    // Validate email
    let email = null;
    if (obj.email) {
      email = obj.email.toLowerCase().trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        results.failed++;
        results.errors.push({ row: rowNum, field: 'email', message: `Invalid email: ${obj.email}` });
        continue;
      }
    }

    const normP = normPhone(obj.phone);

    // Check duplicates within the file
    if (seenInFile.has(normP)) {
      results.duplicates++;
      results.errors.push({ row: rowNum, field: 'phone', message: `Duplicate phone within file: ${obj.phone}` });
      continue;
    }
    if (email && seenInFile.has(email)) {
      results.duplicates++;
      results.errors.push({ row: rowNum, field: 'email', message: `Duplicate email within file: ${obj.email}` });
      continue;
    }

    // Check duplicates in DB
    if (skipDuplicates && (existingPhones.has(normP) || (email && existingEmails.has(email)))) {
      results.duplicates++;
      const f = existingPhones.has(normP) ? 'phone' : 'email';
      results.errors.push({ row: rowNum, field: f, message: `Already exists: a lead with this ${f} is in the database` });
      continue;
    }

    seenInFile.add(normP);
    if (email) seenInFile.add(email);

    // Parse status with support for all official statuses and common import aliases
    let status = 'New';
    if (obj.status) {
      const sNorm = String(obj.status).trim();
      const sLow = sNorm.toLowerCase();
      if (LEAD_STATUSES.includes(sNorm)) {
        status = sNorm;
      } else if (sLow === 'rnr' || sLow === 'ring no response' || sLow.includes('ring no response')) {
        status = 'RNR (Ring No Response)';
      } else if (sLow === 'busy') {
        status = 'Busy';
      } else if (sLow === 'switch off' || sLow === 'switched off') {
        status = 'Switch Off';
      } else {
        const matched = LEAD_STATUSES.find((x) => x.toLowerCase() === sLow);
        if (matched) status = matched;
      }
    }

    // Match course
    let course = null;
    if (obj.course) course = courseMap[obj.course.toLowerCase().trim()] || null;

    // Parse date
    const nextFollowUp = parseDate(obj.nextFollowUp);

    // Build notes from multiple fields (keeping address strictly distinct from notes and location)
    const notesParts = [
      obj.notes,
      obj.location ? `Location: ${obj.location}` : '',
      obj.company ? `Company: ${obj.company}` : '',
    ].filter(Boolean);

    try {
      const seq = await nextSeq('lead');
      const lead = await Lead.create({
        leadId: 'LD-' + String(seq).padStart(5, '0'),
        name: obj.name.substring(0, 120),
        phone: obj.phone,
        email: email || undefined,
        address: obj.address?.trim() || undefined,
        course: course || undefined,
        source: obj.source || 'Import',
        notes: notesParts.join('\n').substring(0, 2000) || undefined,
        status,
        nextFollowUp: nextFollowUp || undefined,
        createdBy: req.user._id,
        history: [{ type: 'created', by: req.user._id }],
      });
      existingPhones.add(normP);
      if (email) existingEmails.add(email);
      importedIds.push(lead._id);
      results.imported++;
      emit('lead:created', lead);
    } catch (e) {
      results.failed++;
      results.errors.push({ row: rowNum, message: e.code === 11000 ? 'Duplicate record (database)' : 'Failed to save lead' });
    }
  }

  await log(
    req.user, 'lead.imported', 'Lead', null,
    `Imported ${results.imported} leads (${results.duplicates} duplicates skipped, ${results.failed} failed)`,
    {}
  );

  res.json({ ...results, importedIds });
});

export default r;
