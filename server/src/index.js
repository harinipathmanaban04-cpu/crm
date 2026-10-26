import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import dns from "node:dns";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

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
import { normEmail } from './util.js';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.error('Set a strong JWT_SECRET in server/.env');
  process.exit(1);
}
const server = http.createServer(app);
initSocket(server, allowedOrigins);

const p = process.env.PORT || 5000;
server.listen(p, '0.0.0.0', () => console.log(`✅ API + Socket.IO running on http://localhost:${p}`));

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/eco_crm';
mongoose.connect(mongoUri)
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
  })
  .catch((e) => {
    console.error('❌ MongoDB connection failed:', e.message);
    console.error('👉 Please make sure MongoDB is running on your machine (mongodb://localhost:27017)');
  });
