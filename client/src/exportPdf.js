/**
 * Pure JavaScript PDF generator for CRM accounts & credentials report.
 * Creates standard PDF 1.4 documents with zero external dependencies.
 */

function cleanText(str) {
  if (str == null) return '';
  return String(str)
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2022\u2023]/g, '*')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function approxTextWidth(text, fontSize = 8.5, isBold = false) {
  const avg = isBold ? 4.9 : 4.4;
  return String(text).length * avg;
}

export function generateAccountsPdfBlob({
  users = [],
  company = 'Eco Friendly Tech Solutions',
  title = 'Accounts & Credentials Directory',
  date = new Date(),
}) {
  const pageWidth = 595.28; // A4 pt (width)
  const pageHeight = 841.89; // A4 pt (height)
  const margin = 26; // generous margins

  // Columns definition: width sum = 543 pt (exact fit for A4 width 595.28 - 2*26)
  // # (26), Name (106), Role (68), Gmail (140), Password (95), Team (60), Status (48)
  const cols = [
    { key: 'idx', label: '#', width: 26, align: 'center' },
    { key: 'name', label: 'Full Name', width: 106, align: 'left' },
    { key: 'role', label: 'Role', width: 68, align: 'left' },
    { key: 'email', label: 'Gmail / Email', width: 140, align: 'left' },
    { key: 'password', label: 'Password', width: 95, align: 'left' },
    { key: 'team', label: 'Team', width: 60, align: 'left' },
    { key: 'status', label: 'Status', width: 48, align: 'center' },
  ];

  const contentWidth = cols.reduce((sum, c) => sum + c.width, 0); // 543 pt

  const rowHeight = 22;
  const headerHeight = 25;
  const topStartY = 705;
  const bottomMargin = 50;

  const rowsPerPageFirst = Math.floor((topStartY - bottomMargin) / rowHeight);
  const rowsPerPageSubsequent = Math.floor((pageHeight - 65 - bottomMargin) / rowHeight);

  const pages = [];
  let remaining = [...users];
  let isFirst = true;

  while (remaining.length > 0 || pages.length === 0) {
    const limit = isFirst ? rowsPerPageFirst : rowsPerPageSubsequent;
    const pageRows = remaining.slice(0, limit);
    remaining = remaining.slice(limit);
    pages.push({ rows: pageRows, isFirst });
    isFirst = false;
  }

  const totalPages = pages.length;
  const pageStreams = [];

  pages.forEach((p, pageIdx) => {
    let s = '';
    const pageNum = pageIdx + 1;

    // First page top banner and header
    if (p.isFirst) {
      // Top teal & coral brand accent lines
      s += `0.137 0.667 0.655 rg\n`; // Brand Teal #23AAA7
      s += `${margin} 806 ${contentWidth * 0.7} 4.5 re f\n`;
      s += `0.992 0.482 0.412 rg\n`; // Brand Coral #FD7B69
      s += `${margin + contentWidth * 0.7} 806 ${contentWidth * 0.3} 4.5 re f\n`;

      // Title & Branding
      s += `BT\n/F2 16 Tf\n0.12 0.12 0.12 rg\n${margin} 776 Td\n(${cleanText(company)}) Tj\nET\n`;
      s += `BT\n/F2 12 Tf\n0.137 0.667 0.655 rg\n${margin} 760 Td\n(${cleanText(title)}) Tj\nET\n`;

      // Metadata Info Box
      const dateStr = `Exported: ${date.toLocaleString()}`;
      const countStr = `Total Accounts: ${users.length}`;
      const confStr = `Internal CRM Access Document`;
      s += `BT\n/F1 8.5 Tf\n0.45 0.45 0.45 rg\n${margin} 742 Td\n(${cleanText(dateStr)}   |   ${cleanText(countStr)}   |   ${cleanText(confStr)}) Tj\nET\n`;

      // Divider line
      s += `0.88 0.88 0.88 RG\n0.75 w\n`;
      s += `${margin} 732 m ${margin + contentWidth} 732 l S\n`;
    }

    const startY = p.isFirst ? topStartY : pageHeight - 65;

    // Table Header Background (Brand Teal)
    s += `0.137 0.667 0.655 rg\n`;
    s += `${margin} ${startY - headerHeight} ${contentWidth} ${headerHeight} re f\n`;

    // Table Header Text
    s += `BT\n/F2 8.5 Tf\n1 1 1 rg\n`;
    let curX = margin;
    cols.forEach((col) => {
      const lblWidth = approxTextWidth(col.label, 8.5, true);
      const textX = col.align === 'center'
        ? curX + Math.max(2, (col.width - lblWidth) / 2)
        : curX + 6;
      s += `${textX} ${startY - headerHeight + 8} Td\n(${cleanText(col.label)}) Tj\n`;
      s += `${-textX} ${-(startY - headerHeight + 8)} Td\n`;
      curX += col.width;
    });
    s += `ET\n`;

    // Rows
    let curY = startY - headerHeight;
    p.rows.forEach((row, rIdx) => {
      const globalIdx = (pageIdx === 0 ? 0 : rowsPerPageFirst + (pageIdx - 1) * rowsPerPageSubsequent) + rIdx + 1;
      const isAlt = rIdx % 2 === 1;

      // Alternating row background
      if (isAlt) {
        s += `0.96 0.98 0.98 rg\n`; // soft teal-gray tint
      } else {
        s += `1 1 1 rg\n`;
      }
      s += `${margin} ${curY - rowHeight} ${contentWidth} ${rowHeight} re f\n`;

      // Bottom cell border
      s += `0.9 0.9 0.9 RG\n0.5 w\n`;
      s += `${margin} ${curY - rowHeight} m ${margin + contentWidth} ${curY - rowHeight} l S\n`;

      // Format values - ONLY actual passwords, no dummy fallbacks!
      const roleName = row.role === 'superadmin' ? 'Super Admin' : row.role === 'admin' ? 'Admin' : 'Sales Exec';
      const statusText = row.active !== false ? 'Active' : 'Inactive';
      const teamText = row.team?.name || row.teamName || (row.role === 'superadmin' ? 'All' : '—');
      const passText = row.plainPassword || 'Not Set';

      const vals = {
        idx: String(globalIdx),
        name: row.name || '—',
        role: roleName,
        email: row.email || '—',
        password: passText,
        team: teamText,
        status: statusText,
      };

      s += `BT\n`;
      let x = margin;
      cols.forEach((col) => {
        let val = vals[col.key] || '—';
        const isBoldCol = col.key === 'password' || col.key === 'role' || col.key === 'status';

        // Fit text without spilling over column bounds
        const maxLen = Math.floor((col.width - 8) / 4.5);
        if (val.length > maxLen) {
          val = val.slice(0, Math.max(3, maxLen - 2)) + '..';
        }

        // Color and font styling based on column
        if (col.key === 'password') {
          s += `/F2 8.5 Tf\n0.12 0.38 0.38 rg\n`; // dark teal bold for password
        } else if (col.key === 'role') {
          s += `/F2 8.5 Tf\n0.2 0.2 0.2 rg\n`;
        } else if (col.key === 'status') {
          if (row.active !== false) {
            s += `/F2 8 Tf\n0.1 0.55 0.2 rg\n`; // green for active
          } else {
            s += `/F2 8 Tf\n0.7 0.2 0.2 rg\n`; // red for inactive
          }
        } else {
          s += `/F1 8.5 Tf\n0.15 0.15 0.15 rg\n`;
        }

        const valWidth = approxTextWidth(val, 8.5, isBoldCol);
        const textX = col.align === 'center'
          ? x + Math.max(2, (col.width - valWidth) / 2)
          : x + 6;

        s += `${textX} ${curY - rowHeight + 6.5} Td\n(${cleanText(val)}) Tj\n`;
        s += `${-textX} ${-(curY - rowHeight + 6.5)} Td\n`;
        x += col.width;
      });
      s += `ET\n`;

      curY -= rowHeight;
    });

    // Outer table border
    const tableTotalHeight = headerHeight + p.rows.length * rowHeight;
    s += `0.8 0.8 0.8 RG\n0.75 w\n`;
    s += `${margin} ${startY - tableTotalHeight} ${contentWidth} ${tableTotalHeight} re S\n`;

    // Footer
    s += `BT\n/F1 7.5 Tf\n0.5 0.5 0.5 rg\n`;
    s += `${margin} 28 Td\n(CONFIDENTIAL - Eco Friendly Tech Solutions CRM Account Credentials) Tj\n`;
    s += `${-margin} -28 Td\n`;
    const pageStr = `Page ${pageNum} of ${totalPages}`;
    s += `${margin + contentWidth - 45} 28 Td\n(${cleanText(pageStr)}) Tj\n`;
    s += `ET\n`;

    pageStreams.push(s);
  });

  // Build standard PDF 1.4 catalog, pages, font, and stream objects
  const objects = [];
  const offsets = [];

  const addObj = (content) => {
    objects.push(content);
    return objects.length;
  };

  // 1: Catalog
  addObj(`<< /Type /Catalog /Pages 2 0 R >>`);

  // 2: Pages placeholder
  const pagesObjIndex = 2;
  objects.push('');

  // 3: Fonts (Helvetica & Helvetica-Bold)
  const font1Index = addObj(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`);
  const font2Index = addObj(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`);

  const pageObjIndices = [];
  pageStreams.forEach((stream) => {
    const streamBytes = new TextEncoder().encode(stream);
    const contentObjIndex = addObj(`<< /Length ${streamBytes.length} >>\nstream\n${stream}\nendstream`);
    const pageObjIndex = addObj(
      `<< /Type /Page /Parent ${pagesObjIndex} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${contentObjIndex} 0 R /Resources << /Font << /F1 ${font1Index} 0 R /F2 ${font2Index} 0 R >> >> >>`
    );
    pageObjIndices.push(pageObjIndex);
  });

  objects[pagesObjIndex - 1] = `<< /Type /Pages /Kids [${pageObjIndices.map((i) => `${i} 0 R`).join(' ')}] /Count ${pageObjIndices.length} >>`;

  let pdf = `%PDF-1.4\n%\xE2\xE3\xCF\xD3\n`;
  offsets.push(0);

  objects.forEach((obj, idx) => {
    offsets.push(new TextEncoder().encode(pdf).length);
    pdf += `${idx + 1} 0 obj\n${obj}\nendobj\n`;
  });

  const xrefOffset = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;

  for (let i = 1; i <= objects.length; i++) {
    const off = String(offsets[i]).padStart(10, '0');
    pdf += `${off} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  const pdfBytes = new TextEncoder().encode(pdf);
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

export function downloadAccountsPdf(users, companyName = 'Eco Friendly Tech Solutions') {
  const blob = generateAccountsPdfBlob({
    users,
    company: companyName,
    date: new Date(),
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const dateStr = new Date().toISOString().slice(0, 10);
  a.download = `eco_crm_accounts_${dateStr}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
