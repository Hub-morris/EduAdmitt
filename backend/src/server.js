import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import pool, { initDb } from './config/db.js';
import { seedData } from './seed.js';
import { sendMail } from './config/mailer.js';
import authRoutes from './routes/auth.js';
import webauthnRoutes from './routes/webauthn.js';
import programmeRoutes from './routes/programmes.js';
import applicationRoutes from './routes/applications.js';
import adminRoutes from './routes/admin.js';
import letterRoutes from './routes/letters.js';
import paymentsRoutes from './routes/payments.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.ORIGIN || 'http://localhost:3000', credentials: true }));
app.use(express.json());

const PgSession = connectPgSimple(session);
app.use(
  session({
    store: new PgSession({ pool, tableName: 'session' }),
    secret: process.env.SESSION_SECRET || 'eduadmit-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      httpOnly: true,
    },
  })
);

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/images', express.static(path.join(__dirname, 'images')));

app.use('/api/auth', authRoutes);
app.use('/api/webauthn', webauthnRoutes);
app.use('/api', programmeRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/letters', letterRoutes);
app.use('/api/payments', paymentsRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/api/debug/smtp', async (req, res) => {
  try {
    const testEmail = process.env.SMTP_USER;
    if (!testEmail) {
      return res.status(400).json({ error: 'SMTP_USER is not configured' });
    }
    const info = await sendMail(testEmail, 'eduAdmit SMTP test', '<p>If you receive this email, SMTP is working.</p>');
    if (!info) {
      return res.status(500).json({ error: 'SMTP test email failed' });
    }
    res.json({ success: true, messageId: info.messageId });
  } catch (err) {
    console.error('SMTP debug test failed:', err);
    res.status(500).json({ error: 'SMTP debug test failed', details: err?.message || 'unknown' });
  }
});

async function start() {
  try {
    await seedData();
    const server = app.listen(PORT, () => {
      console.log(`EduAdmit API running on http://localhost:${PORT}`);
    });

    server.on('error', (err) => {
      if (err && err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Another process may be running.`);
        console.error('If you expected to restart the server, stop the other process or change PORT.');
        process.exit(1);
      }
      console.error('Server error:', err);
      process.exit(1);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    console.error('Make sure PostgreSQL is running (docker compose up -d)');
    process.exit(1);
  }
}

start();
