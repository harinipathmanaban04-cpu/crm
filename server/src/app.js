import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { sanitize } from './util.js';
import { auth } from './middleware.js';
import authRoutes from './routes/auth.js';
import users from './routes/users.js';
import teams from './routes/teams.js';
import leads from './routes/leads.js';
import tasks from './routes/tasks.js';
import customers from './routes/customers.js';
import finance from './routes/finance.js';
import insights from './routes/insights.js';
import mobile from './routes/mobile.js';

const app = express();

app.use(helmet());

// Allow requests from the deployed CRM frontend domains
export const allowedOrigins = [
  'https://crm.eco-friendly.tech',
  'https://crm-front-5hmj.onrender.com',
  ...(process.env.CLIENT_URL || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean),
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without an Origin header and approved frontend domains
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.warn(`CORS blocked origin: ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  req.body = sanitize(req.body);
  next();
});

// Check whether MongoDB is connected before processing API requests
app.use((req, res, next) => {
  if (
    req.path.startsWith('/api') &&
    req.path !== '/api/health' &&
    mongoose.connection.readyState !== 1
  ) {
    return res.status(503).json({
      message:
        'Database connection in progress or MongoDB is offline. Please ensure MongoDB is started.',
    });
  }

  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// Public authentication routes
app.use('/api/auth', authRoutes);

// Protected API routes
const api = express.Router();

api.use(auth());
api.use('/users', users);
api.use('/teams', teams);
api.use('/leads', leads);
api.use('/tasks', tasks);
api.use('/customers', customers);
api.use('/mobile', mobile);
api.use('/', finance);
api.use('/', insights);

app.use('/api', api);

// API route not found
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Not found' });
});

// Error handling
app.use((err, req, res, next) => {
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      message: Object.values(err.errors)
        .map((e) => e.message)
        .join(', '),
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      message: `Invalid value for ${err.path}`,
    });
  }

  if (err.code === 11000) {
    return res.status(409).json({
      message: `Duplicate value: ${Object.keys(err.keyPattern || {}).join(', ')}`,
    });
  }

  // Return a proper response for CORS rejection
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      message: 'This origin is not allowed to access the API.',
    });
  }

  const status = err.status || 500;

  if (status === 500) {
    console.error(err);
  }

  return res.status(status).json({
    message: status === 500 ? 'Server error' : err.message,
  });
});

export default app;
