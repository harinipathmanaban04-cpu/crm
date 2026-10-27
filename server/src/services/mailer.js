import nodemailer from 'nodemailer';
import { isGmailConfigured, sendInvoiceEmail as sendViaGmail } from './gmail.js';

export function isSmtpConfigured() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  return Boolean(host && user && pass);
}

export function isEmailConfigured() {
  return isSmtpConfigured() || isGmailConfigured();
}

function createSmtpTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: false,
    },
  });
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function sendInvoiceMail({ to, subject, text, html, pdfBuffer, filename }) {
  if (!to || !EMAIL_REGEX.test(to.trim())) {
    throw new Error(`Invalid recipient email address: "${to || ''}"`);
  }

  const cleanTo = to.trim();
  const from = process.env.SMTP_FROM || process.env.COMPANY_EMAIL || process.env.SMTP_USER || 'info@eco-friendly.tech';

  // 1. Try SMTP if configured
  if (isSmtpConfigured()) {
    const transporter = createSmtpTransporter();
    const info = await transporter.sendMail({
      from: `"Eco Friendly Tech Solutions" <${from}>`,
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
    'Email service is not configured. Please set SMTP credentials (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS) or connect Gmail in server/.env.'
  );
}
