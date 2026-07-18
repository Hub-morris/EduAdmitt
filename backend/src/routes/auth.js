import express from 'express';
import bcrypt from 'bcryptjs';
import pool from '../config/db.js';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from '../middleware/auth.js';
import { checkLocation } from '../middleware/geo.middleware.js';
import {
  registerController,
  loginController,
  loadOtpUser,
  verifyOtpController,
} from '../controllers/auth.controller.js';
import { verifyEmailToken } from '../controllers/email.controller.js';

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many attempts, try again later' },
});

function validatePassword(pw) {
  if (!pw || pw.length < 8) return 'Password must be at least 8 characters long';
  if (!/[a-z]/.test(pw)) return 'Password must include a lowercase letter';
  if (!/[A-Z]/.test(pw)) return 'Password must include an uppercase letter';
  if (!/[0-9]/.test(pw)) return 'Password must include a number';
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pw)) return 'Password must include a special character';
  return null;
}

router.post('/register', registerController);
router.post('/login', authLimiter, checkLocation, loginController);
router.post('/verify-otp', authLimiter, loadOtpUser, verifyOtpController);
router.get('/verify-email', verifyEmailToken);

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT u.id, u.email, u.role, u.full_name, s.id as student_id FROM users u LEFT JOIN students s ON s.user_id = u.id WHERE u.id = $1',
      [req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    const u = result.rows[0];
    res.json({ id: u.id, email: u.email, role: u.role, fullName: u.full_name, studentId: u.student_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ error: 'New password is required' });

    const pwErr = validatePassword(newPassword);
    if (pwErr) return res.status(400).json({ error: pwErr });

    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    const user = result.rows[0];

    if (currentPassword) {
      const valid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, user.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

export default router;
