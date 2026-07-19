import crypto from 'crypto';
import pool from '../config/db.js';
import { sendMail } from '../config/mailer.js';

export async function sendVerificationEmail(userId, email) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

  await pool.query(
    'UPDATE users SET email_verification_token = $1, email_verification_expires = $2 WHERE id = $3',
    [token, expires, userId]
  );

  const link = `${process.env.ORIGIN}/api/auth/verify-email?token=${token}`;

  sendMail({
    to: email,
    subject: 'Verify your eduAdmit account',
    html: `<p>Click the link below to verify your email. This link expires in 1 hour.</p>
     <p><a href="${link}">${link}</a></p>`,
  }).then((result) => {
    if (!result.success) {
      console.error('Verification email failed:', result.error);
    }
  });
}

export async function verifyEmailToken(req, res) {
  const { token } = req.query;
  if (!token) {
    return res.status(400).json({ error: 'Verification token is required' });
  }

  const result = await pool.query(
    'SELECT id FROM users WHERE email_verification_token = $1 AND email_verification_expires > NOW()',
    [token]
  );

  if (!result.rows.length) {
    return res.status(400).json({ error: 'Invalid or expired verification link' });
  }

  await pool.query(
    'UPDATE users SET is_email_verified = TRUE, email_verification_token = NULL, email_verification_expires = NULL WHERE id = $1',
    [result.rows[0].id]
  );

  res.json({ message: 'Email verified successfully' });
}
