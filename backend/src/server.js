import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { initDb } from './config/db.js';
import { seedData } from './seed.js';
import authRoutes from './routes/auth.js';
import programmeRoutes from './routes/programmes.js';
import applicationRoutes from './routes/applications.js';
import adminRoutes from './routes/admin.js';
import letterRoutes from './routes/letters.js';
import paymentsRoutes from './routes/payments.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/images', express.static(path.join(__dirname, 'images')));

app.use('/api/auth', authRoutes);
app.use('/api', programmeRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/letters', letterRoutes);
app.use('/api/payments', paymentsRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

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
