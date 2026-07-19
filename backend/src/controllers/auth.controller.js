import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import { sendVerificationEmail } from './email.controller.js';
import { createOtpCode, MAX_OTP_ATTEMPTS } from '../utils/otp.util.js';
import { sendMail } from '../config/mailer.js';

const JWT_SECRET = process.env.JWT_SECRET || 'eduadmit-dev-secret';

export function normalizeFingerprint(fingerprint) {
  if (typeof fingerprint !== 'string') return 'unknown';
  const trimmed = fingerprint.trim();
  return trimmed || 'unknown';
}

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

    const pwErr = validatePassword(password);
    if (pwErr) return res.status(400).json({ error: pwErr });

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
    await sendVerificationEmail(user.id, email);

    res.status(201).json({ message: 'Registration successful. Please verify your email before logging in.' });
  } catch (err) {
    res.status(500).json(buildAuthErrorResponse('Registration failed', err));
  }
}

export async function loginController(req, res) {
  try {
    const { email, password, fingerprint } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const normalizedFingerprint = normalizeFingerprint(fingerprint);

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!result.rows.length) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    if (!user.is_email_verified) {
      return res.status(403).json({ error: 'Please verify your email before logging in' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    await pool.query('UPDATE user_otps SET used = TRUE WHERE user_id = $1 AND used = FALSE', [user.id]);

    const otpCode = createOtpCode();
    const otpResult = await pool.query(
      'INSERT INTO user_otps (user_id, code, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'10 minutes\') RETURNING id',
      [user.id, otpCode]
    );

    sendMail({
      to: user.email,
      subject: 'Your eduAdmit login code',
      html: `<p>Your one-time login code is <strong>${otpCode}</strong>. It expires in 10 minutes.</p>`,
    }).then((result) => {
      if (!result.success) {
        console.error('OTP email failed:', result.error);
      }
    });

    res.json({ otpRequired: true, otpId: otpResult.rows[0].id, message: 'OTP sent to your email.' });
  } catch (err) {
    res.status(500).json(buildAuthErrorResponse('Login failed', err));
  }
}

export async function loadOtpUser(req, res, next) {
  try {
    const { otpId } = req.body;
    if (!otpId) {
      return res.status(400).json({ error: 'otpId is required' });
    }

    const result = await pool.query(
      `SELECT
         u.id AS user_id,
         u.email,
         u.role,
         u.full_name,
         u.is_email_verified,
         o.code,
         o.attempts,
         o.expires_at,
         o.used,
         o.id AS otp_id
       FROM user_otps o
       JOIN users u ON u.id = o.user_id
       WHERE o.id = $1`,
      [otpId]
    );

    if (!result.rows.length) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    const row = result.rows[0];
    if (row.used || new Date(row.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    req.pendingOtp = row;
    req.user = {
      id: row.user_id,
      email: row.email,
      role: row.role,
      fullName: row.full_name,
    };

    next();
  } catch (err) {
    res.status(500).json(buildAuthErrorResponse('OTP verification failed', err));
  }
}

export async function verifyOtpController(req, res) {
  try {
    const { otpId, code, fingerprint } = req.body;
    const otp = req.pendingOtp;
    const user = req.user;

    if (!otp || !user) {
      return res.status(400).json({ error: 'OTP verification context is missing' });
    }

    if (!code || !fingerprint) {
      return res.status(400).json({ error: 'OTP code and fingerprint are required' });
    }

    if (otp.code !== code) {
      const attempts = otp.attempts + 1;
      await pool.query('UPDATE user_otps SET attempts = $1 WHERE id = $2', [attempts, otpId]);
      if (attempts >= MAX_OTP_ATTEMPTS) {
        await pool.query('UPDATE user_otps SET used = TRUE WHERE id = $1', [otpId]);
      }
      return res.status(401).json({ error: 'Invalid OTP code' });
    }

    await pool.query('UPDATE user_otps SET used = TRUE WHERE id = $1', [otpId]);
    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);
    req.session.otpVerified = true;

    const normalizedFingerprint = normalizeFingerprint(fingerprint);
    const existingDevice = await pool.query(
      'SELECT id FROM devices WHERE user_id = $1 AND fingerprint = $2',
      [user.id, normalizedFingerprint]
    );

    if (!existingDevice.rows.length) {
      await pool.query(
        'INSERT INTO devices (user_id, fingerprint, first_seen, last_seen) VALUES ($1, $2, NOW(), NOW())',
        [user.id, normalizedFingerprint]
      );
      await sendMail(
        user.email,
        'New device login detected — eduAdmit',
        `<p>A login was just made from a device we haven't seen before. If this wasn't you, please reset your password immediately.</p>`
      );
    } else {
      await pool.query('UPDATE devices SET last_seen = NOW() WHERE id = $1', [existingDevice.rows[0].id]);
    }

    const credsResult = await pool.query('SELECT id FROM webauthn_credentials WHERE user_id = $1', [user.id]);
    if (credsResult.rows.length) {
      req.session.pendingWebAuthn = user.id;
      return res.json({ requiresWebAuthn: true, message: 'Biometric verification required' });
    }

    const token = createJwt(user);
    res.json({ token, user: { id: user.id, email: user.email, role: user.role, fullName: user.fullName } });
  } catch (err) {
    res.status(500).json(buildAuthErrorResponse('OTP verification failed', err));
  }
}
