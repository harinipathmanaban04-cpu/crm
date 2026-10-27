import { google } from 'googleapis';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN_FILE = path.resolve(__dirname, '../../data/gmail.json');

function readTokenFile() {
  try {
    if (fs.existsSync(TOKEN_FILE)) return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
  } catch (e) {
    console.error('Failed to read Gmail token file:', e.message);
  }
  return null;
}

function writeTokenFile(tokens) {
  try {
    fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true });
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
  } catch (e) {
    console.error('Failed to save Gmail token:', e.message);
  }
}

function oauthClient() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const redirectUri = process.env.GMAIL_REDIRECT_URI || 'http://localhost:5000/api/gmail/callback';
  if (!clientId || !clientSecret) return null;
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function isGmailConfigured() {
  const client = oauthClient();
  if (!client) return false;
  const envToken = process.env.GMAIL_REFRESH_TOKEN;
  const fileToken = readTokenFile();
  return !!(envToken || fileToken?.refresh_token);
}

function getRefreshToken() {
  return process.env.GMAIL_REFRESH_TOKEN || readTokenFile()?.refresh_token || null;
}

export function getAuthUrl() {
  const client = oauthClient();
  if (!client) throw new Error('Gmail OAuth not configured (missing GMAIL_CLIENT_ID/SECRET)');
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/gmail.send'],
  });
}

export async function exchangeCode(code) {
  const client = oauthClient();
  if (!client) throw new Error('Gmail OAuth not configured');
  const { tokens } = await client.getToken(code);
  if (tokens.refresh_token) writeTokenFile(tokens);
  return tokens;
}

function makeRawMessage({ to, subject, text, pdfBuffer, filename }) {
  const boundary = 'eco_crm_boundary_' + Date.now();
  const pdfBase64 = pdfBuffer.toString('base64');
  const lines = [];
  lines.push(`To: ${to}`);
  lines.push(`Subject: ${subject}`);
  lines.push('MIME-Version: 1.0');
  lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
  lines.push('');
  lines.push(`--${boundary}`);
  lines.push('Content-Type: text/plain; charset="UTF-8"');
  lines.push('Content-Transfer-Encoding: 7bit');
  lines.push('');
  lines.push(text);
  lines.push('');
  lines.push(`--${boundary}`);
  lines.push(`Content-Type: application/pdf; name="${filename}"`);
  lines.push('Content-Transfer-Encoding: base64');
  lines.push(`Content-Disposition: attachment; filename="${filename}"`);
  lines.push('');
  lines.push(pdfBase64);
  lines.push('');
  lines.push(`--${boundary}--`);
  const raw = lines.join('\r\n');
  return Buffer.from(raw).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sendInvoiceEmail({ to, subject, text, pdfBuffer, filename }) {
  const client = oauthClient();
  if (!client) throw new Error('Gmail OAuth not configured');
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error('Gmail not connected (no refresh token)');
  client.setCredentials({ refresh_token: refreshToken });
  const gmail = google.gmail({ version: 'v1', auth: client });
  const raw = makeRawMessage({ to, subject, text, pdfBuffer, filename });
  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  });
  return res.data.id;
}