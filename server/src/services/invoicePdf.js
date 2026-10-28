import PDFDocument from 'pdfkit';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { amountToIndianWords } from '../util.js';
import { drawInvoiceHeaderDecoration, drawInvoiceFooterDecoration } from '../assets/vectorDecoration.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Pre-load and cache static image buffers once into memory to eliminate repeated disk I/O
let cachedLogoBuffer = null;
let cachedWatermarkBuffer = null;

try {
  const logoPath = path.resolve(__dirname, '../assets/logo.png');
  if (fs.existsSync(logoPath)) cachedLogoBuffer = fs.readFileSync(logoPath);
} catch (e) {
  console.warn('Failed to pre-cache logo image:', e.message);
}

try {
  const watermarkPath = path.resolve(__dirname, '../assets/invoice-watermark.png');
  if (fs.existsSync(watermarkPath)) cachedWatermarkBuffer = fs.readFileSync(watermarkPath);
} catch (e) {
  console.warn('Failed to pre-cache watermark image:', e.message);
}

// Pre-check system font availability once
const calibriPath = 'C:/Windows/Fonts/calibri.ttf';
const calibriBoldPath = 'C:/Windows/Fonts/calibrib.ttf';
const calibriItalicPath = 'C:/Windows/Fonts/calibrii.ttf';
let hasCalibri = false;
let hasCalibriItalic = false;

try {
  hasCalibri = fs.existsSync(calibriPath) && fs.existsSync(calibriBoldPath);
  hasCalibriItalic = hasCalibri && fs.existsSync(calibriItalicPath);
} catch {
  hasCalibri = false;
}

// In-memory PDF buffer cache (keyed by invoice version)
const pdfCache = new Map();
const MAX_CACHE_ENTRIES = 150;

export function invalidateInvoicePdfCache(invoiceId) {
  if (!invoiceId) return;
  const prefix = String(invoiceId);
  for (const key of pdfCache.keys()) {
    if (key.startsWith(prefix)) {
      pdfCache.delete(key);
    }
  }
}

function formatDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatInr(val) {
  const num = Number(val) || 0;
  return num.toLocaleString('en-IN');
}

export async function generateInvoicePdf(inv, options = {}) {
  const invId = inv._id ? String(inv._id) : null;
  const cacheKey = invId
    ? `${invId}_${inv.invoiceNo || ''}_${new Date(inv.updatedAt || inv.createdAt || 0).getTime()}_${inv.paid || 0}_${inv.total || 0}_${inv.status || ''}_${(inv.paymentRows || []).length}`
    : null;

  if (cacheKey && !options.bypassCache && pdfCache.has(cacheKey)) {
    return pdfCache.get(cacheKey);
  }

  return new Promise((resolve, reject) => {
    // Standard A4 dimensions: 595.28 x 841.89 pt
    const doc = new PDFDocument({
      size: 'A4',
      margin: 0,
      autoFirstPage: true,
      info: {
        Title: `Payment Invoice ${inv.invoiceNo || ''}`,
        Author: 'Eco Friendly Tech Solutions',
        Subject: 'Payment Invoice',
        Creator: 'Eco Friendly Tech Solutions CRM',
      },
    });

    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => {
      const buffer = Buffer.concat(chunks);
      if (cacheKey && !options.bypassCache) {
        if (pdfCache.size >= MAX_CACHE_ENTRIES) {
          const oldestKey = pdfCache.keys().next().value;
          if (oldestKey) pdfCache.delete(oldestKey);
        }
        pdfCache.set(cacheKey, buffer);
      }
      resolve(buffer);
    });
    doc.on('error', reject);

    // Font setup: prefer Calibri if available, fallback to Helvetica
    let regularFont = 'Helvetica';
    let boldFont = 'Helvetica-Bold';
    let italicFont = 'Helvetica-Oblique';

    if (hasCalibri) {
      try {
        doc.registerFont('Calibri', calibriPath);
        doc.registerFont('Calibri-Bold', calibriBoldPath);
        if (hasCalibriItalic) {
          doc.registerFont('Calibri-Italic', calibriItalicPath);
          italicFont = 'Calibri-Italic';
        }
        regularFont = 'Calibri';
        boldFont = 'Calibri-Bold';
      } catch (e) {
        console.warn('Using standard fallback fonts:', e.message);
      }
    }

    // 1. Draw top geometric header decoration
    try {
      drawInvoiceHeaderDecoration(doc);
    } catch (e) {
      console.error('Failed to draw header decoration:', e.message);
    }

    // 2. Draw EFTS Logo on top-left using cached buffer
    if (cachedLogoBuffer) {
      try {
        doc.image(cachedLogoBuffer, 34, 115, { width: 56 });
      } catch (e) {
        console.warn('Failed to embed logo:', e.message);
      }
    }

    // 3. Document Title & Branding
    // Centered header block
    doc.font(boldFont).fontSize(16).fillColor('#000000')
      .text('ECO FRIENDLY TECH SOLUTIONS', 0, 192, { align: 'center', width: 595.28 });

    doc.font(boldFont).fontSize(13.5).fillColor('#000000')
      .text('PAYMENT INVOICE', 0, 213, { align: 'center', width: 595.28 });

    doc.font(italicFont).fontSize(9.5).fillColor('#333333')
      .text('Education • Technology • Career Development', 0, 230, { align: 'center', width: 595.28 });

    // Customer & Invoice dynamic data
    const customerName = inv.customerName || inv.customer?.name || '—';
    const mobileNo = inv.customerPhone || inv.customer?.phone || '—';
    const programName = inv.programName || inv.course?.name || '—';
    const invoiceNo = inv.invoiceNo || 'EFTS-INV-—';
    const invoiceDate = formatDate(inv.invoiceDate || inv.createdAt || new Date());
    const paymentDate = formatDate(inv.paymentDate || inv.paymentRows?.[0]?.date || inv.createdAt || new Date());
    const paymentMode = inv.paymentMode || inv.method || inv.paymentRows?.[0]?.mode || 'UPI';
    const paymentStatus = inv.status || 'Pending';

    // 4. Invoice Details Table (4-column grid)
    // Coords matching original template: left = 38.7, right = 556.7 (width = 518)
    const t1X = 38.7;
    const t1Width = 518;
    const colW1 = 129.5;
    const colW2 = 129.5;
    const colW3 = 129.5;
    const colW4 = 129.5;
    const rowH = 16.5;
    let t1Y = 252;

    const infoGrid = [
      [
        { text: 'Invoice No.', font: boldFont, size: 9 },
        { text: invoiceNo, font: boldFont, size: 9.5 },
        { text: 'Invoice Date', font: boldFont, size: 9 },
        { text: invoiceDate, font: regularFont, size: 9.5 },
      ],
      [
        { text: 'Customer / Student Name', font: regularFont, size: 9 },
        { text: customerName, font: boldFont, size: 9.5 },
        { text: 'Mobile No.', font: regularFont, size: 9 },
        { text: mobileNo, font: regularFont, size: 9.5 },
      ],
      [
        { text: 'Program / Internship', font: regularFont, size: 9 },
        { text: programName ? (inv.mode ? `${programName} (${inv.mode})` : programName) : '—', font: regularFont, size: 9.5 },
        { text: 'Payment Date', font: regularFont, size: 9 },
        { text: paymentDate, font: regularFont, size: 9.5 },
      ],
      [
        { text: 'Payment Mode', font: regularFont, size: 9 },
        { text: paymentMode, font: regularFont, size: 9.5 },
        { text: 'Payment Status', font: regularFont, size: 9 },
        { text: paymentStatus, font: boldFont, size: 9.5 },
      ],
    ];

    doc.lineWidth(0.5).strokeColor('#000000');

    for (let r = 0; r < infoGrid.length; r++) {
      const curY = t1Y + r * rowH;
      const row = infoGrid[r];
      const xs = [t1X, t1X + colW1, t1X + colW1 + colW2, t1X + colW1 + colW2 + colW3];
      const widths = [colW1, colW2, colW3, colW4];

      for (let c = 0; c < 4; c++) {
        // Draw cell border
        doc.rect(xs[c], curY, widths[c], rowH).stroke();

        // Cell content
        const item = row[c];
        doc.font(item.font).fontSize(item.size).fillColor('#000000');
        doc.text(item.text, xs[c] + 6, curY + 3.5, {
          width: widths[c] - 12,
          ellipsis: true,
          lineBreak: false,
        });
      }
    }

    // 5. Central Watermark behind Payment History Table using cached buffer
    if (cachedWatermarkBuffer) {
      try {
        doc.save();
        // Exact original coordinates from template: x = 133.75, y = 301.35, width = 325.75, height = 239.14
        doc.image(cachedWatermarkBuffer, 133.75, 301.35, { width: 325.75, height: 239.14 });
        doc.restore();
      } catch (e) {
        console.warn('Failed to embed watermark:', e.message);
      }
    }

    // 6. Payment History Table
    const t2Y = t1Y + infoGrid.length * rowH + 18;
    const t2X = 38.7;
    const t2Width = 518;
    // Columns: S.No (42), Description (236), Date (85), EMI (45), Amount (110)
    const cols = [
      { key: 'sNo', label: 'S.No.', width: 42, align: 'center' },
      { key: 'description', label: 'Description', width: 236, align: 'left' },
      { key: 'date', label: 'Date', width: 85, align: 'center' },
      { key: 'emi', label: 'EMI', width: 45, align: 'center' },
      { key: 'amount', label: 'Amount (₹)', width: 110, align: 'right' },
    ];

    let curY = t2Y;
    const headerH = 20;

    // Draw header background (clean white or subtle gray)
    doc.lineWidth(0.5).strokeColor('#000000');
    let xAcc = t2X;
    cols.forEach((col) => {
      doc.rect(xAcc, curY, col.width, headerH).stroke();
      doc.font(boldFont).fontSize(10.5).fillColor('#000000');
      const textX = col.align === 'right' ? xAcc : xAcc + (col.align === 'center' ? 0 : 8);
      const textW = col.align === 'right' ? col.width - 8 : (col.align === 'center' ? col.width : col.width - 16);
      doc.text(col.label, textX, curY + 4.5, { width: textW, align: col.align });
      xAcc += col.width;
    });

    curY += headerH;

    // Payment rows
    let paymentRows = Array.isArray(inv.paymentRows) && inv.paymentRows.length > 0
      ? [...inv.paymentRows]
      : [];

    // Fallback if no paymentRows but has payment or total
    if (paymentRows.length === 0) {
      if (inv.paid > 0) {
        paymentRows.push({
          sNo: 1,
          description: `${programName} Internship – ${paymentMode}`,
          date: inv.paymentDate || inv.createdAt || new Date(),
          emiNumber: '1',
          amount: inv.paid,
        });
      } else {
        paymentRows.push({
          sNo: 1,
          description: `${programName} Internship`,
          date: inv.dueDate || inv.createdAt || new Date(),
          emiNumber: '1',
          amount: inv.total || 0,
        });
      }
    }

    // Render payment rows
    const pRowH = 28; // allows 2 lines for description
    paymentRows.forEach((row, idx) => {
      let cellX = t2X;
      const sNoText = String(row.sNo || idx + 1);
      const descText = row.description || `${programName} Internship`;
      const dateText = formatDate(row.date);
      const emiText = String(row.emiNumber ?? (idx + 1));
      const amountText = formatInr(row.amount);

      cols.forEach((col) => {
        doc.rect(cellX, curY, col.width, pRowH).stroke();
        doc.font(regularFont).fontSize(9.5).fillColor('#000000');

        let cellContent = '';
        if (col.key === 'sNo') cellContent = sNoText;
        else if (col.key === 'description') cellContent = descText;
        else if (col.key === 'date') cellContent = dateText;
        else if (col.key === 'emi') cellContent = emiText;
        else if (col.key === 'amount') cellContent = amountText;

        const padX = col.align === 'right' ? cellX : cellX + (col.align === 'center' ? 0 : 8);
        const padW = col.align === 'right' ? col.width - 8 : (col.align === 'center' ? col.width : col.width - 16);
        const topPad = col.key === 'description' && cellContent.length > 32 ? 3 : 8;

        doc.text(cellContent, padX, curY + topPad, {
          width: padW,
          align: col.align,
        });

        cellX += col.width;
      });

      curY += pRowH;
    });

    // If fewer than 3 rows, add placeholder row matching master template
    if (paymentRows.length < 3) {
      for (let i = paymentRows.length + 1; i <= 3; i++) {
        let cellX = t2X;
        cols.forEach((col) => {
          doc.rect(cellX, curY, col.width, 16.5).stroke();
          doc.font(regularFont).fontSize(9).fillColor('#555555');
          let placeholder = '';
          if (col.key === 'sNo') placeholder = String(i);
          else if (col.key === 'description') placeholder = '____________________________________';
          else if (col.key === 'date') placeholder = '________';
          else if (col.key === 'amount') placeholder = '____________';

          const padX = col.align === 'right' ? cellX : cellX + (col.align === 'center' ? 0 : 8);
          const padW = col.align === 'right' ? col.width - 8 : (col.align === 'center' ? col.width : col.width - 16);
          doc.text(placeholder, padX, curY + 3.5, { width: padW, align: col.align });
          cellX += col.width;
        });
        curY += 16.5;
      }
    }

    // Summary Rows
    // Total Amount, Amount Paid, Balance Amount
    const totalAmount = Number(inv.total) || 0;
    const paidAmount = Number(inv.paid) || 0;
    const balanceAmount = Number(inv.balance != null ? inv.balance : Math.max(0, totalAmount - paidAmount));

    const isFullyPaid = paidAmount >= totalAmount && totalAmount > 0 && balanceAmount <= 0;
    const paidDisplay = isFullyPaid ? 'YES' : `₹ ${formatInr(paidAmount)}/-`;
    const balanceDisplay = balanceAmount <= 0 ? 'NO' : `₹ ${formatInr(balanceAmount)}/-`;

    const summaryRows = [
      { label: 'Total Amount', value: `₹ ${formatInr(totalAmount)}/-`, isBold: true },
      { label: 'Amount Paid', value: paidDisplay, isBold: isFullyPaid },
      { label: 'Balance Amount', value: balanceDisplay, isBold: false },
    ];

    const sumLeftW = cols[0].width + cols[1].width + cols[2].width + cols[3].width; // 408
    const sumRightW = cols[4].width; // 110
    const sumRowH = 16.5;

    summaryRows.forEach((s) => {
      doc.rect(t2X, curY, sumLeftW, sumRowH).stroke();
      doc.rect(t2X + sumLeftW, curY, sumRightW, sumRowH).stroke();

      doc.font(s.isBold ? boldFont : regularFont).fontSize(10).fillColor('#000000');
      doc.text(s.label, t2X + 10, curY + 3.5, { width: sumLeftW - 20, align: 'left' });

      doc.font(boldFont).fontSize(10).fillColor('#000000');
      doc.text(s.value, t2X + sumLeftW, curY + 3.5, { width: sumRightW - 8, align: 'right' });

      curY += sumRowH;
    });

    curY += 12;

    // 7. Amount in Words
    const words = inv.amountInWords || amountToIndianWords(totalAmount);
    doc.font(boldFont).fontSize(10).fillColor('#000000');
    doc.text(`Amount in Words:  ${words}`, t2X, curY);

    curY += 16;

    // 8. Terms & Conditions
    doc.font(boldFont).fontSize(10).fillColor('#000000');
    doc.text('Terms & Conditions', t2X, curY);

    curY += 13;

    const terms = [
      'This invoice is issued against the payment received by Eco Friendly Tech Solutions.',
      'All payments are subject to verification and applicable company terms.',
      'For partial payments, the balance amount must be settled as per the agreed payment schedule.',
      'Any refund, cancellation, or adjustment will be handled according to the applicable company policy.',
      'Please retain this invoice as proof of payment.',
    ];

    doc.font(regularFont).fontSize(8.8).fillColor('#111111');
    terms.forEach((term) => {
      doc.text(`•  ${term}`, t2X, curY, { width: t2Width, lineGap: 1 });
      curY += 13;
    });

    curY += 8;

    // 9. Thank You Message
    doc.font(boldFont).fontSize(9).fillColor('#000000');
    doc.text('Thank you for choosing Eco Friendly Tech Solutions.', 0, curY, {
      align: 'center',
      width: 595.28,
    });

    // 10. Teal Divider Line & Footer Contact Information
    // Line at y = 802 pt
    const lineY = 802;
    doc.save();
    doc.strokeColor([41, 182, 166])
      .lineWidth(0.75)
      .moveTo(t1X, lineY)
      .lineTo(t1X + t1Width, lineY)
      .stroke();
    doc.restore();

    doc.font(regularFont).fontSize(8.8).fillColor('#333333');
    doc.text(
      'www.ecofriendlytechsolutions.tech  |  info@eco-friendly.tech  |  +91 9043 538 838',
      0,
      lineY + 6,
      { align: 'center', width: 595.28 }
    );

    // 11. Bottom Vector Decoration
    try {
      drawInvoiceFooterDecoration(doc);
    } catch (e) {
      console.error('Failed to draw footer decoration:', e.message);
    }

    doc.end();
  });
}
