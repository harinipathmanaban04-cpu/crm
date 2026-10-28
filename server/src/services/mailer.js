import nodemailer from 'nodemailer';
import { isGmailConfigured, sendInvoiceEmail as sendViaGmail } from './gmail.js';

let cachedTransporter = null;

export function isSmtpConfigured() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  return Boolean(host && user && pass);
}

export function isEmailConfigured() {
  return isSmtpConfigured() || isGmailConfigured();
}

function getSmtpTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = (process.env.SMTP_USER || process.env.EMAIL_USER || '').trim();
  const pass = (process.env.SMTP_PASS || process.env.EMAIL_PASS || '').trim().replace(/\s+/g, '');
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: 5,
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 30000,
    tls: {
      rejectUnauthorized: false,
      minVersion: 'TLSv1.2',
    },
  });

  return cachedTransporter;
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export async function sendInvoiceMail({ to, subject, text, html, pdfBuffer, filename }) {
  if (!to || typeof to !== 'string' || !EMAIL_REGEX.test(to.trim())) {
    throw new Error(`Invalid recipient email address "${to || ''}". Please provide a valid email (e.g. name@gmail.com).`);
  }

  const cleanTo = to.trim().toLowerCase();

  // Validate PDF attachment buffer
  if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
    throw new Error('PDF attachment buffer is empty or corrupt. Could not send email.');
  }

  // 1. Try SMTP if configured
  if (isSmtpConfigured()) {
    const transporter = getSmtpTransporter();
    const smtpHost = (process.env.SMTP_HOST || '').toLowerCase();
    const smtpUser = (process.env.SMTP_USER || process.env.EMAIL_USER || '').trim();
    const rawFrom = process.env.SMTP_FROM || smtpUser || 'aroedison3438@gmail.com';

    let fromAddress = smtpUser || 'aroedison3438@gmail.com';
    let fromName = 'Eco Friendly Tech Solutions';

    // Parse clean display name and address from SMTP_FROM
    const emailMatch = rawFrom.match(/<([^>]+)>/) || rawFrom.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch && emailMatch[1]) {
      // Gmail SMTP requires the envelope sender address to be the authenticated user
      if (smtpHost.includes('gmail.com')) {
        fromAddress = smtpUser || emailMatch[1].trim();
      } else {
        fromAddress = emailMatch[1].trim();
      }
    }

    const nameMatch = rawFrom.match(/^["']?([^<"']+)["']?\s*</);
    if (nameMatch && nameMatch[1]?.trim()) {
      fromName = nameMatch[1].trim();
    }

    const info = await transporter.sendMail({
      from: {
        name: fromName,
        address: fromAddress,
      },
      replyTo: {
        name: 'Eco Friendly Tech Solutions',
        address: process.env.COMPANY_EMAIL || 'info@eco-friendly.tech',
      },
      to: cleanTo,
      subject,
      text,
      html: html || text.replace(/\n/g, '<br/>'),
      attachments: [
        {
          filename: filename || 'Invoice.pdf',
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    return { ok: true, messageId: info.messageId, provider: 'smtp' };
  }

  // 2. Fallback to Gmail OAuth if configured
  if (isGmailConfigured()) {
    const messageId = await sendViaGmail({
      to: cleanTo,
      subject,
      text,
      pdfBuffer,
      filename: filename || 'Invoice.pdf',
    });
    return { ok: true, messageId, provider: 'gmail' };
  }

  // 3. Graceful error explaining missing configuration
  throw new Error(
    'Email service is not configured. Please set SMTP credentials (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS) in server/.env or Render environment.'
  );
}
