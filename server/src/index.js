import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import dns from "node:dns";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {
  // Use default system resolver if custom servers cannot be set
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

import http from 'http';
import mongoose from 'mongoose';
import app, { allowedOrigins } from './app.js';
app.set('trust proxy', 1);
import bcrypt from 'bcryptjs';
import { initSocket } from './realtime.js';
import { User } from './models.js';
import { verifySmtpConnection, isEmailConfigured } from './services/mailer.js';
import { normEmail } from './util.js';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.error('Set a strong JWT_SECRET in server/.env');
  process.exit(1);
}
const server = http.createServer(app);
initSocket(server, allowedOrigins);

const defaultPort = Number(process.env.PORT) || 5001;

function listenWithFallback(port, remainingAttempts = 5) {
  const onError = (err) => {
    if (err && (err.code === 'EADDRINUSE' || err.code === 'EACCES')) {
      if (remainingAttempts > 0) {
        console.warn(`⚠️ Port ${port} is unavailable (${err.code}). Trying port ${port + 1}...`);
        listenWithFallback(port + 1, remainingAttempts - 1);
      } else {
        console.error(`❌ Ports ${defaultPort}-${port} are unavailable. Set a free PORT in server/.env.`);
        process.exit(1);
      }
    } else {
      console.error('❌ HTTP server error:', err);
      process.exit(1);
    }
  };

  server.once('error', onError);
  server.listen(port, '0.0.0.0', () => {
    server.removeListener('error', onError);
    console.log(`✅ API + Socket.IO running on http://localhost:${port}`);
  });
}

listenWithFallback(defaultPort);

process.on('unhandledRejection', (reason) => {
  console.error('⚠️ Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught exception:', err);
  // Do not crash server on transient socket resets or client disconnects
  if (err && (err.code === 'ECONNRESET' || err.code === 'EPIPE' || err.code === 'ETIMEDOUT')) {
    return;
  }
});

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/eco_crm';
mongoose.connect(mongoUri, {
  maxPoolSize: 10,
  minPoolSize: 2,
  serverSelectionTimeoutMS: 8000,
  socketTimeoutMS: 45000,
})
  .then(async () => {
    // auto-create the Super Admin on first start so login always works
    const email = normEmail(process.env.SEED_EMAIL || 'superadmin@gmail.com');
    const seedPw = process.env.SEED_PASSWORD || 'Admin@12345';
    if (!(await User.exists({ email }))) {
      await User.create({
        name: process.env.SEED_NAME || 'Super Admin',
        email,
        role: 'superadmin',
        passwordHash: await bcrypt.hash(seedPw, 12),
        mustChangePassword: false,
      });
      console.log('Created Super Admin', email);
    }
    console.log('✅ Database connected:', mongoose.connection.name);
    // Safe email configuration diagnostics (no secrets)
    console.log(`[email] Email configured: ${isEmailConfigured()}`);
    verifySmtpConnection().catch(() => {});
  })
  .catch((e) => {
    console.error('❌ MongoDB connection failed:', e.message);
    console.error('👉 Please make sure MongoDB is running on your machine (mongodb://localhost:27017) or set MONGO_URI in server/.env');
  });
