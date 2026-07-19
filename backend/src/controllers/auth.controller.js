import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'eduadmit-dev-secret';

function validatePassword(pw) {
  if (!pw || pw.length < 8) return 'Password must be at least 8 characters long';
  if (!/[a-z]/.test(pw)) return 'Password must include a lowercase letter';
  if (!/[A-Z]/.test(pw)) return 'Password must include an uppercase letter';
  if (!/[0-9]/.test(pw)) return 'Password must include a number';
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pw)) return 'Password must include a special character';
  return null;
}

function createJwt(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function buildAuthErrorResponse(fallback, error) {
  const details = error?.message || 'Unknown error';
  console.error(`${fallback}:`, details);
  if (error?.stack) {
    console.error(error.stack);
  }

  return {
    error: fallback,
    details,
  };
}

export async function registerController(req, res) {
  try {
    const { email, password, fullName } = req.body;
    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'Email, password, and full name are required' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hash = await bcrypt.hash(password, 10);
    const userResult = await pool.query(
      'INSERT INTO users (email, password_hash, role, full_name, last_login_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING id, email, role, full_name',
      [email, hash, 'student', fullName]
    );

    const user = userResult.rows[0];
    await pool.query('INSERT INTO students (user_id, full_name, email) VALUES ($1, $2, $3)', [user.id, fullName, email]);

    res.status(201).json({ message: 'Registration successful.' });
  } catch (err) {
    res.status(500).json(buildAuthErrorResponse('Registration failed', err));
  }
}

export async function loginController(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!result.rows.length) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    const token = createJwt(user);
    res.json({ token, user: { id: user.id, email: user.email, role: user.role, fullName: user.full_name } });
  } catch (err) {
    res.status(500).json(buildAuthErrorResponse('Login failed', err));
  }
}

export async function forgotPasswordController(req, res) {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) {
      return res.status(400).json({ error: 'Email and new password are required' });
    }

    const pwErr = validatePassword(newPassword);
    if (pwErr) return res.status(400).json({ error: pwErr });

    const result = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Email not found' });
    }

    const user = result.rows[0];
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, user.id]);

    res.json({ success: true, message: 'Password updated successfully. Please login with your new password.' });
  } catch (err) {
    res.status(500).json(buildAuthErrorResponse('Failed to reset password', err));
  }
}
